import cv2
import sys
import json
import numpy as np

def merge_rects_constrained(rects, separation_boundary, tolerance=40):
    if not rects:
        return []

    # Sort blocks by column relative to the separation (mid-point of the ROI)
    left_group = []
    right_group = []
    
    for r in rects:
        center_x = r[0] + r[2]/2
        if center_x < separation_boundary:
            left_group.append(r)
        else:
            right_group.append(r)
            
    def merge_group(group):
        if not group: return []
        boxes = []
        for (x, y, w, h) in group:
            boxes.append([x, y, x+w, y+h])
        boxes = np.array(boxes)
        
        while True:
            merged = False
            new_boxes = []
            skip = [False] * len(boxes)
            
            for i in range(len(boxes)):
                if skip[i]: continue
                ix1, iy1, ix2, iy2 = boxes[i]
                
                for j in range(i+1, len(boxes)):
                    if skip[j]: continue
                    jx1, jy1, jx2, jy2 = boxes[j]
                    
                    # Vertical Merge with Constraints
                    # Increased from 50 to 60 to catch options that are slightly further away,
                    # while relying on the glue_kernel to merge horizontal/close elements first.
                    overlap_x = (max(ix1, jx1) < min(ix2, jx2) + 20)
                    overlap_y = (max(iy1, jy1) < min(iy2, jy2) + 60)
                    
                    if overlap_x and overlap_y:
                        ix1 = min(ix1, jx1)
                        iy1 = min(iy1, jy1)
                        ix2 = max(ix2, jx2)
                        iy2 = max(iy2, jy2)
                        skip[j] = True
                        merged = True
                new_boxes.append([ix1, iy1, ix2, iy2])
            boxes = np.array(new_boxes)
            if not merged: break
            
        res = []
        for (x1,y1,x2,y2) in boxes:
            res.append({'x': int(x1), 'y': int(y1), 'width': int(x2-x1), 'height': int(y2-y1)})
        return res

    merged_left = merge_group(left_group)
    merged_right = merge_group(right_group)
    
    return merged_left + merged_right

def detect_question_blocks(image_path, roi=None):
    try:
        # 1. Read Image
        original_img = cv2.imread(image_path)
        if original_img is None:
            raise Exception("Image not found")

        # --- ROI HANDLING ---
        roi_x, roi_y = 0, 0
        
        if roi:
            roi_x, roi_y, roi_w, roi_h = roi
            # Ensure ROI is within bounds
            h, w = original_img.shape[:2]
            roi_x = max(0, roi_x)
            roi_y = max(0, roi_y)
            roi_w = min(w - roi_x, roi_w)
            roi_h = min(h - roi_y, roi_h)
            
            # Crop
            process_img = original_img[int(roi_y):int(roi_y+roi_h), int(roi_x):int(roi_x+roi_w)]
        else:
            process_img = original_img

        # --- NORMALIZATION ---
        target_width = 1000.0
        h, w = process_img.shape[:2]
        if w == 0 or h == 0:
             print(json.dumps([]))
             return

        scale_ratio = target_width / float(w)
        target_height = int(h * scale_ratio)
        img = cv2.resize(process_img, (int(target_width), target_height), interpolation=cv2.INTER_AREA)

        # 2. Pre-processing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # 4. Remove horizontal lines
        h_kernel_size = int(target_width / 30) 
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_size, 1))
        remove_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
        cnts = cv2.findContours(remove_horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        for c in cnts:
            cv2.drawContours(thresh, [c], -1, (0,0,0), 4)

        # 5. Connect Components
        # Increased horizontal kernel (5->20) to better connect options (A B C D) roughly on the same line
        glue_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 30)) 
        morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, glue_kernel)
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 5))
        dilation = cv2.dilate(morph, dilate_kernel, iterations=1)
        
        contours, _ = cv2.findContours(dilation, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        initial_blocks = []
        img_area = img.shape[0] * img.shape[1]
        
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = w * h
            
            # Filters
            # Relaxed area filter (0.001 -> 0.0002) to keep small detached options
            if area > (img_area * 0.0002):
                aspect = w / float(h)
                
                # Vertical Separator Filter
                center_x = target_width / 2
                is_in_middle = (center_x - 50) < x < (center_x + 50)
                is_tall = h > (target_height * 0.15)
                if is_in_middle and is_tall and w < (target_width * 0.05): continue

                # APPEND NORMALIZED COORDINATES (Not Original yet)
                # We merge in the normalized 1000px space for consistency.
                initial_blocks.append((x, y, w, h))


        # 7. SPLIT & MERGE (Silo Strategy)
        mid_point = int(target_width / 2) # Use target_width mid point since we are in normalized space
        final_blocks = merge_rects_constrained(initial_blocks, separation_boundary=mid_point)
        
        # 8. POST-MERGE CLEANUP & SHIFT BACK
        results = []
        process_area = img_area # using normalized area for percentage check
        
        for b in final_blocks:
            if (b['width'] * b['height']) > (process_area * 0.005):
                # SCALE BACK TO ORIGINAL & SHIFT
                # orig = norm / scale_ratio
                final_x = int(b['x'] / scale_ratio)
                final_y = int(b['y'] / scale_ratio)
                final_w = int(b['width'] / scale_ratio)
                final_h = int(b['height'] / scale_ratio)
                
                final_x += int(roi_x)
                final_y += int(roi_y)
                
                results.append({
                    'x': final_x,
                    'y': final_y,
                    'width': final_w,
                    'height': final_h
                })

        # 9. Sort
        results.sort(key=lambda b: (b['y'] // 100, b['x'])) # Simple sort
        
        print(json.dumps(results))

    except Exception as e:
        import traceback
        print(f"Python Error: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    img_path = sys.argv[1]
    
    # Parse ROI args if present: python script.py img.png x y w h
    roi_arg = None
    if len(sys.argv) >= 6:
        try:
            roi_arg = (
                float(sys.argv[2]), 
                float(sys.argv[3]), 
                float(sys.argv[4]), 
                float(sys.argv[5])
            )
        except:
            pass
            
    detect_question_blocks(img_path, roi=roi_arg)
