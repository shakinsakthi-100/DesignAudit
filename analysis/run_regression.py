import argparse
import json
import sys
import os
import cv2

# Add parent directory to sys.path so we can import analysis
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis.detector import analyze_visual_regression

def main():
    parser = argparse.ArgumentParser(description="AIVAR Level 2 Visual Regression CLI")
    parser.add_argument("--baseline", required=True, help="Path to baseline image")
    parser.add_argument("--current", required=True, help="Path to current image")
    parser.add_argument("--output_annotated", required=True, help="Path to save the annotated diff image")
    parser.add_argument("--api_key", default=None, help="OpenAI API Key (optional)")
    parser.add_argument("--diff_threshold", type=int, default=15, help="Pixel difference threshold (5-50)")
    parser.add_argument("--min_area", type=int, default=80, help="Minimum pixel area for difference contour (10-500)")

    args = parser.parse_args()

    if not os.path.exists(args.baseline):
        print(json.dumps({"error": f"Baseline image not found: {args.baseline}"}))
        sys.exit(1)
    if not os.path.exists(args.current):
        print(json.dumps({"error": f"Current image not found: {args.current}"}))
        sys.exit(1)

    try:
        report, annotated_img = analyze_visual_regression(
            baseline_path=args.baseline,
            current_path=args.current,
            api_key=args.api_key,
            diff_threshold=args.diff_threshold,
            min_area=args.min_area
        )

        # Save annotated image
        os.makedirs(os.path.dirname(os.path.abspath(args.output_annotated)), exist_ok=True)
        cv2.imwrite(args.output_annotated, annotated_img)

        # Print JSON report to stdout
        print(json.dumps(report, indent=2))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({"error": f"Analysis failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
