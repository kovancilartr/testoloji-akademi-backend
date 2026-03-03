import cv2
import numpy as np
import sys
import json
import base64

def process_omr(image_base64):
    try:
        # 1. DECODE & PREPROCESS
        nparr = np.frombuffer(base64.b64decode(image_base64), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"success": False, "error": "Could not decode image"}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. FIND CORNER MARKERS (Fiducials)
        _, thresh = cv2.threshold(gray, 70, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        squares = []
        for cnt in contours:
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                if w > 15 and h > 15 and 0.8 < w/h < 1.2:
                    squares.append((x, y, w, h))

        if len(squares) < 4:
            squares = sorted([cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 100], 
                             key=lambda s: s[2]*s[3], reverse=True)[:4]

        if len(squares) < 4:
            return {"success": False, "error": "Köşe hizalama kareleri bulunamadı. Formu net ve tam çekin."}

        squares = sorted(squares, key=lambda s: s[1])
        top = sorted(squares[:2], key=lambda s: s[0])
        bottom = sorted(squares[len(squares)-2:], key=lambda s: s[0])
        
        src_pts = np.float32([
            [top[0][0] + top[0][2]/2, top[0][1] + top[0][3]/2],
            [top[1][0] + top[1][2]/2, top[1][1] + top[1][3]/2],
            [bottom[0][0] + bottom[0][2]/2, bottom[0][1] + bottom[0][3]/2],
            [bottom[1][0] + bottom[1][2]/2, bottom[1][1] + bottom[1][3]/2]
        ])

        width, height = 1000, 1400
        dst_pts = np.float32([[0, 0], [width, 0], [0, height], [width, height]])
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(gray, M, (width, height))
        warped_color = cv2.warpPerspective(img, M, (width, height))
        
        # 3. QR CODE DETECTION
        qr_detector = cv2.QRCodeDetector()
        qr_data = None
        # Try to find QR code in the upper region of the form
        header_area = warped_color[0:450, 450:950] # Top right area usually
        data, points, _ = qr_detector.detectAndDecode(header_area)
        if data:
            qr_data = data
        else:
            # Fallback: try the whole warped image if not found in header
            data, _, _ = qr_detector.detectAndDecode(warped_color)
            if data: qr_data = data

        # 4. DETECT BUBBLES DYNAMICALLY
        warped_blur = cv2.GaussianBlur(warped, (5, 5), 0)
        circles = cv2.HoughCircles(warped_blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=20, 
                                  param1=50, param2=22, minRadius=9, maxRadius=15)

        if circles is None:
            return {"success": False, "error": "Optik baloncuklar bulunamadı."}

        circles = np.round(circles[0, :]).astype("int")
        grid_circles = [c for c in circles if c[1] > 450] 
        
        grid_circles = sorted(grid_circles, key=lambda c: c[0])
        cols = [[], [], [], []]
        for c in grid_circles:
            x = c[0]
            if x < 250: cols[0].append(c)
            elif x < 500: cols[1].append(c)
            elif x < 750: cols[2].append(c)
            else: cols[3].append(c)

        final_answers = []
        options = ["A", "B", "C", "D", "E"]
        thresh_img = cv2.adaptiveThreshold(warped, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)

        for c_idx, col_circles in enumerate(cols):
            col_circles = sorted(col_circles, key=lambda c: (c[1], c[0]))
            for row_start in range(0, len(col_circles), 5):
                row = col_circles[row_start : row_start + 5]
                if len(row) < 5: continue
                row = sorted(row, key=lambda c: c[0])
                avg_y = np.mean([c[1] for c in row])
                current_q_num = (c_idx * 10) + (row_start // 5) + 1
                if current_q_num > 40: break

                intensities = []
                for bubble in row:
                    bx, by, br = bubble
                    mask = np.zeros(warped.shape, dtype="uint8")
                    cv2.circle(mask, (bx, by), br - 1, 255, -1)
                    mean = cv2.mean(thresh_img, mask=mask)[0]
                    intensities.append(mean)
                
                max_val = max(intensities)
                avg_val = np.mean(intensities)
                marked_opt = None
                
                if max_val > 70:
                    sorted_ints = sorted(intensities, reverse=True)
                    if max_val > (avg_val + 35) and sorted_ints[0] > (sorted_ints[1] + 25):
                        idx = intensities.index(max_val)
                        if idx < len(options): marked_opt = options[idx]

                final_answers.append({"questionNumber": current_q_num, "markedOption": marked_opt})

        existing_nums = {a["questionNumber"] for a in final_answers}
        for i in range(1, 41):
            if i not in existing_nums:
                final_answers.append({"questionNumber": i, "markedOption": None})

        final_answers = sorted(final_answers, key=lambda x: x["questionNumber"])[:40]
        return {"success": True, "answers": final_answers, "qrCode": qr_data}

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        img_b64 = data.get("image", "")
        if img_b64.startswith("data:image"):
            img_b64 = img_b64.split(",")[1]
            
        result = process_omr(img_b64)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
