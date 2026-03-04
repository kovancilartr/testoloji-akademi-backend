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
            return {"success": False, "error": "Görüntü çözümlenemedi."}

        # High-quality preprocessing to handle screen reflections
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # 2. FIND CORNER MARKERS (Fiducials)
        # Using adaptive thresholding for varying light conditions
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 100: continue
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                if 0.7 < (w/h) < 1.3:
                    candidates.append((x + w/2, y + h/2, area))

        if len(candidates) < 4:
            return {"success": False, "error": "Köşe kareleri bulunamadı. Lütfen 4 siyah karenin tam göründüğünden emin olun."}

        # FIND TRUE CORNERS BASED ON POSITION (Not Size!)
        # This prevents picking the QR code or Name Box as corners
        tl = min(candidates, key=lambda s: s[0] + s[1])
        br = max(candidates, key=lambda s: s[0] + s[1])
        tr = max(candidates, key=lambda s: s[0] - s[1])
        bl = min(candidates, key=lambda s: s[0] - s[1])

        src_pts = np.float32([
            [tl[0], tl[1]], [tr[0], tr[1]], 
            [bl[0], bl[1]], [br[0], br[1]]
        ])

        # CRITICAL FIX: Markers are NOT at literal 0,0. They have ~3.5% margin in A4.
        width, height = 1000, 1400
        marginX = 45 # Standard margin for 1000px width
        marginY = 45 # Standard margin for 1400px height
        dst_pts = np.float32([
            [marginX, marginY], [width - marginX, marginY],
            [marginX, height - marginY], [width - marginX, height - marginY]
        ])

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(gray, M, (width, height))
        
        # Binary threshold for markings
        warped_thresh = cv2.adaptiveThreshold(warped, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 11)
        
        # 3. QR CODE
        qr_detector = cv2.QRCodeDetector()
        qr_data, _, _ = qr_detector.detectAndDecode(warped)
        
        # 4. FIXED GRID BUBBLE ANALYSIS - TESTOLOJI V2 TEMPLATE
        final_answers = []
        options = ["A", "B", "C", "D", "E"]
        
        # Exact values calculated from warped debug output
        col_x_offsets = [159, 362, 565, 768]
        start_y = 473
        row_spacing = 35.1
        bubble_spacing = 27.0
        bubble_radius = 10

        for col_idx in range(4):
            base_x = col_x_offsets[col_idx]
            for row_idx in range(10):
                q_num = (col_idx * 10) + row_idx + 1
                center_y = int(start_y + (row_idx * row_spacing))
                
                intensities = []
                for opt_idx in range(5):
                    center_x = int(base_x + (opt_idx * bubble_spacing))
                    
                    # --- DYNAMIC LOCAL SEARCH ---
                    # Check its neighbors for best coverage (handles micro-shifts)
                    max_fill = 0
                    for dy in range(-5, 6, 2):
                        for dx in range(-5, 6, 2):
                            mask = np.zeros(warped.shape, dtype="uint8")
                            cv2.circle(mask, (int(center_x + dx), int(center_y + dy)), bubble_radius, 255, -1)
                            total = cv2.countNonZero(mask)
                            marked = cv2.countNonZero(cv2.bitwise_and(warped_thresh, warped_thresh, mask=mask))
                            fill = (marked / total) * 100
                            if fill > max_fill:
                                max_fill = fill
                    
                    intensities.append(max_fill)
                
                # Analysis with dynamic sensitivity
                marked_opt = None
                max_val = max(intensities)
                if max_val > 24: # High quality filling detection
                    # Ensure it's clear winner
                    sorted_ints = sorted(intensities, reverse=True)
                    if (sorted_ints[0] - sorted_ints[1]) > 10:
                        marked_opt = options[intensities.index(max_val)]
                        
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
