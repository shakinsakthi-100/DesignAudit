import cv2
import numpy as np
import base64
import json
import os
import sys
import google.generativeai as genai

def pad_images_to_match(img1, img2):
    """
    Pad both images to the maximum dimensions of both, using the corner background color.
    """
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    
    max_h = max(h1, h2)
    max_w = max(w1, w2)
    
    # Corner pixel color of baseline
    bg_color1 = [int(x) for x in img1[0, 0]]
    # Corner pixel color of current
    bg_color2 = [int(x) for x in img2[0, 0]]
    
    # Pad images
    padded1 = cv2.copyMakeBorder(img1, 0, max_h - h1, 0, max_w - w1, cv2.BORDER_CONSTANT, value=bg_color1)
    padded2 = cv2.copyMakeBorder(img2, 0, max_h - h2, 0, max_w - w2, cv2.BORDER_CONSTANT, value=bg_color2)
    
    return padded1, padded2

def detect_visual_differences(baseline_path, current_path, diff_threshold=15, min_area=80):
    """
    Compares baseline and current images using OpenCV.
    Detects difference bounding boxes, size changes, color shifts, and element displacement.
    """
    img1 = cv2.imread(baseline_path)
    img2 = cv2.imread(current_path)
    
    if img1 is None or img2 is None:
        raise ValueError("Could not read one or both input images.")
        
    padded1, padded2 = pad_images_to_match(img1, img2)
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(padded1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(padded2, cv2.COLOR_BGR2GRAY)
    
    # Compute absolute difference
    diff = cv2.absdiff(gray1, gray2)
    
    # Threshold the diff to make it binary
    _, thresh = cv2.threshold(diff, diff_threshold, 255, cv2.THRESH_BINARY)
    
    # Dilate binary image to group adjacent pixel differences
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 20))
    dilated = cv2.dilate(thresh, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    raw_differences = []
    diff_index = 1
    
    # Copy current image for visualization
    annotated_img = padded2.copy()
    
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        # Filter out tiny noise contours
        if w < 6 or h < 6 or (w * h) < min_area:
            continue
            
        # Crop regions for comparison
        crop1 = padded1[y:y+h, x:x+w]
        crop2 = padded2[y:y+h, x:x+w]
        
        # Measure average colors
        avg_color1 = cv2.mean(crop1)[:3] # BGR
        avg_color2 = cv2.mean(crop2)[:3] # BGR
        
        # Color distance (Euclidean in BGR)
        color_dist = np.sqrt(sum((c1 - c2) ** 2 for c1, c2 in zip(avg_color1, avg_color2)))
        
        # Check for shifts / position shifts using template matching
        # Look in a wider search window on the current image
        pad_size = 40
        sy_start = max(0, y - pad_size)
        sy_end = min(padded2.shape[0], y + h + pad_size)
        sx_start = max(0, x - pad_size)
        sx_end = min(padded2.shape[1], x + w + pad_size)
        
        search_area = padded2[sy_start:sy_end, sx_start:sx_end]
        
        shift_detected = False
        dx, dy = 0, 0
        
        if search_area.shape[0] >= h and search_area.shape[1] >= w:
            try:
                res = cv2.matchTemplate(search_area, crop1, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, max_loc = cv2.minMaxLoc(res)
                
                if max_val > 0.82:
                    matched_x = sx_start + max_loc[0]
                    matched_y = sy_start + max_loc[1]
                    dx = matched_x - x
                    dy = matched_y - y
                    if dx != 0 or dy != 0:
                        shift_detected = True
            except Exception:
                pass
                
        # Draw bounding box and ID label on annotated image
        cv2.rectangle(annotated_img, (x, y), (x + w, y + h), (0, 0, 255), 2)
        cv2.putText(annotated_img, f"#{diff_index}", (x, max(15, y - 5)), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        
        # Format colors for report
        rgb1 = [int(avg_color1[2]), int(avg_color1[1]), int(avg_color1[0])]
        rgb2 = [int(avg_color2[2]), int(avg_color2[1]), int(avg_color2[0])]
        
        raw_differences.append({
            "id": diff_index,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "color_dist": float(color_dist),
            "rgb_baseline": rgb1,
            "rgb_current": rgb2,
            "shift_detected": shift_detected,
            "dx": int(dx),
            "dy": int(dy)
        })
        
        diff_index += 1
        
    # Reverse differences so they read top-to-bottom, left-to-right (roughly)
    raw_differences.sort(key=lambda d: (d["y"], d["x"]))
    # Re-assign IDs sequentially after sorting
    for idx, diff_item in enumerate(raw_differences):
        diff_item["id"] = idx + 1
        
    return raw_differences, annotated_img, padded1, padded2

def encode_image_base64(img):
    """
    Converts OpenCV image to base64 JPEG string
    """
    # Resize image if it exceeds 1200px width/height to save bandwidth and token costs
    max_dim = 1200
    h, w = img.shape[:2]
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    b64 = base64.b64encode(buffer).decode('ascii')
    return f"data:image/jpeg;base64,{b64}"

def get_color_name(rgb):
    r, g, b = rgb
    if r > 220 and g > 220 and b > 220: return "white/very light"
    if r < 40 and g < 40 and b < 40: return "black/very dark"
    if abs(r - g) < 25 and abs(g - b) < 25:
        if r > 150: return "light gray"
        if r < 100: return "dark gray"
        return "gray"
    if r > 150 and g < 100 and b < 100: return "red"
    if g > 150 and r < 100 and b < 100: return "green"
    if b > 150 and r < 100 and g < 100: return "blue"
    if r > 150 and g > 150 and b < 100: return "yellow"
    return "a different color tint"

def get_region_name(x, y, w, h, img_w, img_h):
    if not img_w or not img_h:
        return f"coordinates (x={x}, y={y})"
        
    if w > img_w * 0.8 and h > img_h * 0.8:
        return "entire page"
    
    cx = x + w / 2
    cy = y + h / 2
    
    vertical = "top"
    if cy > img_h * 0.66:
        vertical = "bottom"
    elif cy > img_h * 0.33:
        vertical = "middle"
        
    horizontal = "left"
    if cx > img_w * 0.66:
        horizontal = "right"
    elif cx > img_w * 0.33:
        horizontal = "center"
        
    if vertical == "middle" and horizontal == "center":
        return "center of the page"
    else:
        return f"{vertical}-{horizontal} area"

def get_gemini_image_part(img):
    max_dim = 1200
    h, w = img.shape[:2]
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return {
        "mime_type": "image/jpeg",
        "data": buffer.tobytes()
    }

def run_ai_reasoning(api_key, baseline_img, current_img, annotated_img, raw_diffs):
    """
    Sends baseline, current, and annotated difference images to Gemini Vision
    to analyze the visual regressions and classify findings.
    Falls back to local rule-based reasoning on any failures.
    """
    img_h, img_w = baseline_img.shape[:2]
    if not api_key:
        return run_local_reasoning_fallback(raw_diffs, img_w, img_h)
        
    try:
        genai.configure(api_key=api_key)

        # Prepare image parts
        part_baseline = get_gemini_image_part(baseline_img)
        part_current = get_gemini_image_part(current_img)
        
        # If no differences detected, return empty report early
        if not raw_diffs:
            return []
            
        part_annotated = get_gemini_image_part(annotated_img)
        
        # Build differences list string for the prompt
        diffs_desc = []
        for d in raw_diffs:
            desc = f"- ID #{d['id']}: Bounding box x:{d['x']}, y:{d['y']}, w:{d['width']}, h:{d['height']}. "
            if d['shift_detected']:
                desc += f"Shifted by dx:{d['dx']}px, dy:{d['dy']}px. "
            if d['color_dist'] > 30:
                desc += f"Significant average color change: Baseline RGB{d['rgb_baseline']} -> Current RGB{d['rgb_current']}. "
            else:
                desc += f"Color distance is small ({d['color_dist']:.1f}). "
            diffs_desc.append(desc)
            
        diffs_summary_str = "\n".join(diffs_desc)
        
        prompt_text = f"""
You are AIVAR Level 2, an advanced UI/UX Design Review Agent specializing in Visual Regression testing.
We have compared a baseline screenshot and a current screenshot of a web application and detected visual differences.

We have provided three images:
1. The Baseline Image (Original)
2. The Current Image (Updated)
3. The Annotated Current Image showing numbered red bounding boxes representing the exact changes detected.

Here is the measurement data from our OpenCV difference analyzer for the numbered regions:
{diffs_summary_str}

Please perform a thorough UX evaluation for each difference. Determine what visually changed, whether it is an improvement, regression, or neutral, the confidence score, and the user impact.

CRITICAL INSTRUCTIONS ON CLASSIFICATION & AESTHETIC SHIFTS:
1. Distinguish subjective aesthetic shifts (e.g. modernized typography, brand-aligned color changes, rounded button corners, cleaner padding) from objective visual regressions (e.g. broken layout, overlapping text, missing buttons, clipped text, broken alignment, unreadable low contrast).
2. Classify as "regression" ONLY if the change clearly degrades usability, readability, or function.
3. Classify as "improvement" if the change clearly enhances usability (e.g., improves contrast, fixes layout alignment, clarifies CTA).
4. Classify as "neutral" if the change is a benign styling update or subjective design modification that doesn't harm or help usability.
5. Confidence scores (value between 0.0 and 1.0) must reflect real uncertainty. Assign lower confidence (0.50 - 0.75) for ambiguous design updates that could be subjective brand preferences, and higher confidence (0.80 - 0.99) for clear bugs or obvious usability improvements.
6. Explicitly flag accessibility regressions: if contrast ratio drops, font sizes reduce, or spacing is compressed such that it hurts readability, classify it as a regression and note it in user impact.

Return your response strictly as a JSON object of the following format:
{{
  "differences": [
    {{
      "id": 1,
      "what_changed": "Button background color changed from a saturated blue to neutral gray",
      "classification": "regression", // Must be "improvement", "regression", or "neutral"
      "confidence_score": 0.95,       // Value between 0.0 and 1.0
      "user_impact": "The gray background reduces the call-to-action visibility and violates brand design guidelines. High contrast drop."
    }}
  ]
}}

Ensure every ID in the input list has a corresponding entry in the JSON response. Do not include any markdown backticks or extra text, just output the raw JSON object.
"""

        # Try a guarded call to a supported generative model.
        # Probe a list of candidate Gemini models in order; if one fails, try the next.
        candidates = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5', 'gemini-1.0']
        ai_result = None
        last_exc = None
        for candidate in candidates:
            try:
                model = genai.GenerativeModel(candidate)
                response = model.generate_content([
                    prompt_text,
                    part_baseline,
                    part_current,
                    part_annotated
                ])
                # response may be an object or have .text
                text = getattr(response, 'text', None)
                if callable(text):
                    text = text()
                if text is None and isinstance(response, str):
                    text = response
                if not text:
                    # Try to get .response.text()
                    try:
                        text = response.response.text()
                    except Exception:
                        text = ''

                text = text.strip()
                if text.startswith('```json'): text = text[7:]
                if text.startswith('```'): text = text[3:]
                if text.endswith('```'): text = text[:-3]
                text = text.strip()
                ai_result = json.loads(text)
                # success — break out
                break
            except Exception as inner_exc:
                last_exc = inner_exc
                # try next candidate
                print(f"Model {candidate} failed: {str(inner_exc)}", file=sys.stderr)
                continue

        if ai_result is None:
            # Log last exception and fall back to local rules
            if last_exc is not None:
                print(f"AI Vision reasoning failed for all candidates: {str(last_exc)}. Falling back to local rules.", file=sys.stderr)
            else:
                print("AI Vision reasoning failed: no candidates attempted. Falling back to local rules.", file=sys.stderr)
            return run_local_reasoning_fallback(raw_diffs, img_w, img_h)
        
        ai_diffs = {item["id"]: item for item in ai_result.get("differences", [])}
        
        # Merge AI reasoning with OpenCV locations
        final_differences = []
        for d in raw_diffs:
            ai_data = ai_diffs.get(d["id"], {})
            
            final_differences.append({
                "what_changed": ai_data.get("what_changed", f"Visual change detected at #{d['id']}"),
                "location": {
                    "x": d["x"],
                    "y": d["y"],
                    "width": d["width"],
                    "height": d["height"]
                },
                "classification": ai_data.get("classification", "neutral"),
                "confidence_score": ai_data.get("confidence_score", 0.80),
                "user_impact": ai_data.get("user_impact", "Layout or rendering differences can affect user readability and interaction flow.")
            })
            
        return final_differences
        
    except Exception as e:
        # Fallback to local rule-based if any unexpected failure occurs
        print(f"AI Vision reasoning overall failed: {str(e)}. Falling back to local measurements.", file=sys.stderr)
        return run_local_reasoning_fallback(raw_diffs, img_w, img_h)

def run_local_reasoning_fallback(raw_diffs, img_w=None, img_h=None):
    """
    Offline/local rule-based generator for differences if OpenAI API is unavailable.
    Detects structural layout changes, component changes, shifts, and color variations.
    """
    final_differences = []
    for d in raw_diffs:
        region = get_region_name(d['x'], d['y'], d['width'], d['height'], img_w, img_h)
        desc_parts = []
        classif = "neutral"
        impact = f"Visual changes detected in the {region}."
        conf = 0.75
        
        area = d["width"] * d["height"]
        
        # Determine if it's a major structural change
        is_large = area > 1200 or d["width"] > 80 or d["height"] > 80
        is_huge = area > 5000 or d["width"] > 150 or d["height"] > 150
        
        if d["shift_detected"]:
            shift_dist = np.sqrt(d["dx"]**2 + d["dy"]**2)
            desc_parts.append(f"Element in the {region} shifted by {abs(d['dx'])}px horizontally and {abs(d['dy'])}px vertically")
            
            if shift_dist <= 2.5:
                classif = "neutral"
                impact = f"Very minor rendering or text-rendering subpixel shift detected in the {region}. Likely benign and unnoticeable."
                conf = 0.60
            elif shift_dist <= 8.0:
                classif = "regression"
                impact = f"Subtle element shift detected in the {region}. May affect alignment guides and spacing consistency."
                conf = 0.70
            else:
                classif = "regression"
                impact = f"Significant layout displacement detected in the {region}. Elements may overlap, break structural alignment, or confuse user scanning flow."
                conf = float(min(0.95, 0.75 + (shift_dist / 100)))
                
        # If it's a large mismatch area and template match failed, it is likely a content change/mismatch!
        elif not d["shift_detected"] and (is_large or d["color_dist"] > 40):
            base_color = get_color_name(d['rgb_baseline'])
            curr_color = get_color_name(d['rgb_current'])
            
            if is_huge:
                classif = "regression"
                desc_parts.append(f"Major layout/structural mismatch detected in the {region} (size: {d['width']}x{d['height']}px)")
                impact = f"Critical structural mismatch or complete layout replacement in the {region}. Elements are missing, newly added, or heavily restructured, breaking design consistency."
                conf = 0.90
            elif is_large:
                classif = "regression"
                desc_parts.append(f"Component content/layout mismatch in the {region} (size: {d['width']}x{d['height']}px)")
                impact = f"Significant visual content difference in the {region}. A component, button, text block, or image has been modified, removed, or newly introduced."
                conf = 0.85
            else:
                classif = "regression"
                desc_parts.append(f"Element structural change or state modification in the {region}")
                impact = f"Visual difference in element properties (likely size, shape, or content update) in the {region} with average color shift from {base_color} to {curr_color}."
                conf = 0.78
                
        elif d["color_dist"] > 15:
            base_color = get_color_name(d['rgb_baseline'])
            curr_color = get_color_name(d['rgb_current'])
            desc_parts.append(f"Color changed from {base_color} to {curr_color} in the {region}")
            
            if d["color_dist"] <= 30:
                classif = "neutral"
                impact = f"Subtle background or text color shift in the {region}. Likely a theme update, hover state change, or minor antialiasing difference."
                conf = 0.65
            elif d["color_dist"] <= 60:
                classif = "neutral"
                impact = f"Intentional color shift or brand styling change in the {region}. Verify if readability and contrast ratios are preserved."
                conf = 0.70
            else:
                classif = "regression"
                impact = f"High-contrast color shift in the {region} (from {base_color} to {curr_color}). This could violate brand guidelines, reduce text legibility, or disrupt the visual hierarchy."
                conf = 0.82
        else:
            desc_parts.append(f"Layout or rendering tweak in the {region} (size: {d['width']}x{d['height']}px)")
            classif = "neutral"
            impact = "Minor bounding box rendering or spacing adjustment occurred in this area."
            conf = 0.70
            
        final_differences.append({
            "what_changed": "; ".join(desc_parts),
            "location": {
                "x": d["x"],
                "y": d["y"],
                "width": d["width"],
                "height": d["height"]
            },
            "classification": classif,
            "confidence_score": conf,
            "user_impact": impact
        })
        
    return final_differences

def analyze_visual_regression(baseline_path, current_path, api_key=None, diff_threshold=15, min_area=80):
    """
    Main entry point. Runs OpenCV comparison and OpenAI Vision.
    Returns the final structured report JSON and the annotated visual image.
    """
    # Perform visual regression analysis on given image paths
    raw_diffs, annotated_img, padded1, padded2 = detect_visual_differences(
        baseline_path, current_path, diff_threshold, min_area
    )
    
    findings = run_ai_reasoning(api_key, padded1, padded2, annotated_img, raw_diffs)
    
    # Calculate summary counts
    improvements = sum(1 for f in findings if f["classification"] == "improvement")
    regressions = sum(1 for f in findings if f["classification"] == "regression")
    neutrals = sum(1 for f in findings if f["classification"] == "neutral")
    
    # Overall verdict
    if regressions > 0:
        verdict = "regression"
    elif improvements > 0:
        verdict = "improvement"
    else:
        verdict = "neutral"
        
    report = {
        "overall_verdict": verdict,
        "summary": {
            "improvements": improvements,
            "regressions": regressions,
            "neutral": neutrals
        },
        "differences": findings
    }
    
    return report, annotated_img