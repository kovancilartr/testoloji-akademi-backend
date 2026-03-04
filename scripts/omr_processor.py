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
        
        # 2. FIND CORNER MARKERS (Fiducials) - HIGH ROBUSTNESS
        # Using Bilateral filter to remove noise but keep edges
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        # Advanced thresholding to find black squares in various lighting
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 10)
        
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 150: continue # Ignore small noise
            
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = float(w) / h
                if 0.6 < aspect_ratio < 1.4:
                    candidates.append((x, y, w, h, area))

        # Take the most prominent 4 squares
        candidates = sorted(candidates, key=lambda s: s[4], reverse=True)[:4]

        if len(candidates) < 4:
            return {"success": False, "error": "Köşe hizalama kareleri tespit edilemedi. Lütfen formu daha net ve tam çekin."}

        # Sort top-bottom then left-right
        candidates = sorted(candidates, key=lambda s: s[1])
        top = sorted(candidates[:2], key=lambda s: s[0])
        bottom = sorted(candidates[2:4], key=lambda s: s[0])
        
        src_pts = np.float32([
            [top[0][0] + top[0][2]/2, top[0][1] + top[0][3]/2],
            [top[1][0] + top[1][2]/2, top[1][1] + top[1][3]/2],
            [bottom[0][0] + bottom[0][2]/2, bottom[0][1] + bottom[0][3]/2],
            [bottom[1][0] + bottom[1][2]/2, bottom[1][1] + bottom[1][3]/2]
        ])

        # Normalize form to 1000x1400 standard
        width, height = 1000, 1400
        dst_pts = np.float32([[0, 0], [width, 0], [0, height], [width, height]])
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(gray, M, (width, height))
        
        # Binary mask for bubble analysis
        warped_thresh = cv2.adaptiveThreshold(warped, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 8)
        
        # 3. QR CODE
        qr_detector = cv2.QRCodeDetector()
        qr_data, _, _ = qr_detector.detectAndDecode(warped)
        
        # 4. ROBUST GRID ANALYSIS (GLOBAL STANDARD)
        final_answers = []
        options = ["A", "B", "C", "D", "E"]
        
        # Grid Parameters (Optimized for the template)
        col_x_offsets = [120, 350, 580, 810]
        start_y = 535
        row_spacing = 21.6
        bubble_spacing = 24.8
        base_radius = 9

        for col_idx in range(4):
            base_x = col_x_offsets[col_idx]
            for row_idx in range(10):
                q_num = (col_idx * 10) + row_idx + 1
                expected_y = int(start_y + (row_idx * row_spacing))
                
                intensities = []
                for opt_idx in range(5):
                    expected_x = int(base_x + (opt_idx * bubble_spacing))
                    
                    # --- LOCAL SEARCH LOGIC ---
                    # Scan a small window (+/- 4px) to find the best local alignment
                    max_fill = 0
                    for off_y in range(-3, 4):
                        for off_x in range(-3, 4):
                            mask = np.zeros(warped.shape, dtype="uint8")
                            cv2.circle(mask, (expected_x + off_x, expected_y + off_y), base_radius, 255, -1)
                            
                            total = cv2.countNonZero(mask)
                            marked = cv2.countNonZero(cv2.bitwise_and(warped_thresh, warped_thresh, mask=mask))
                            fill = (marked / total) * 100
                            max_fill = max(max_fill, fill)
                    
                    intensities.append(max_fill)
                
                # --- DECISION LOGIC ---
                marked_opt = None
                max_val = max(intensities)
                sorted_ints = sorted(intensities, reverse=True)
                
                # Professional confidence thresholding
                if max_val > 25: # At least 25% fill
                    # Ensure it's significantly darker than the second best option
                    if (sorted_ints[0] - sorted_ints[1]) > 12:
                        idx = intensities.index(max_val)
                        marked_opt = options[idx]
                
                final_answers.append({"questionNumber": q_num, "markedOption": marked_opt})

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
