import streamlit as st
import cv2
import json
import os
import numpy as np
from PIL import Image
from analysis.detector import analyze_visual_regression

# Page configuration for a premium dark-mode aligned layout
st.set_page_config(
    page_title="AIVAR — UI/UX Visual Regression Review Agent",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom premium styling using CSS injections
st.markdown("""
<style>
    .reportview-container {
        background: #0f1115;
    }
    .main .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    .badge {
        padding: 4px 10px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 12px;
        display: inline-block;
    }
    .badge-regression {
        background-color: #ffebe9;
        color: #ff3b30;
        border: 1px solid #ff8f8a;
    }
    .badge-improvement {
        background-color: #e6f6ec;
        color: #34c759;
        border: 1px solid #84df9b;
    }
    .badge-neutral {
        background-color: #f2f2f7;
        color: #8e8e93;
        border: 1px solid #d1d1d6;
    }
    .metric-card {
        background-color: #ffffff;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid #e5e5ea;
        text-align: center;
    }
    .verdict-header {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 10px;
        padding: 10px 20px;
        border-radius: 6px;
        text-align: center;
    }
    .verdict-regression {
        background-color: #ffebe9;
        color: #ff3b30;
        border: 2px solid #ff3b30;
    }
    .verdict-improvement {
        background-color: #e6f6ec;
        color: #34c759;
        border: 2px solid #34c759;
    }
    .verdict-neutral {
        background-color: #f2f2f7;
        color: #8e8e93;
        border: 2px solid #8e8e93;
    }
</style>
""", unsafe_allow_html=True)

# Title & Description
st.title("🔍 AIVAR — UI/UX Design Review Agent")
st.caption("AI-powered design audit and visual regression agent. Evaluates hierarchy, contrast, spacing, alignment, and consistency.")

# Sidebar Configuration
st.sidebar.image("https://img.icons8.com/isometric-line/100/visible.png", width=80)
st.sidebar.title("AIVAR Settings")
st.sidebar.markdown("Configure thresholds and API integrations below:")

# OpenAI API Key Input (loads default environment if present)
default_api_key = os.environ.get("OPENAI_API_KEY", "")
api_key = st.sidebar.text_input(
    "OpenAI API Key",
    value=default_api_key,
    type="password",
    help="Required for OpenAI Vision UX impact reasoning. If empty, local rule-based analysis will be used as a fallback."
)

# Advanced OpenCV parameters
st.sidebar.subheader("OpenCV Analysis Config")
diff_threshold = st.sidebar.slider(
    "Pixel diff sensitivity",
    min_value=5,
    max_value=50,
    value=15,
    help="Lower values detect minor color variations. Higher values are less sensitive."
)
min_area = st.sidebar.slider(
    "Minimum pixel area change",
    min_value=10,
    max_value=500,
    value=80,
    help="Ignore differences smaller than this number of pixels."
)

import requests

st.sidebar.markdown("---")
audit_level = st.sidebar.selectbox(
    "Select Audit Level",
    ["Level 1: Single Page Audit", "Level 2: Visual Regression", "Level 3: Autonomous Site Audit"]
)

# Track level transitions and reset state
if "current_level" not in st.session_state:
    st.session_state["current_level"] = audit_level

if st.session_state["current_level"] != audit_level:
    st.session_state["current_level"] = audit_level
    for key in ["report", "annotated_img", "l1_report"]:
        if key in st.session_state:
            del st.session_state[key]

if audit_level == "Level 1: Single Page Audit":
    st.subheader("🌐 Level 1: Single Page Design Audit")
    st.caption("Upload a single screenshot or mockup to evaluate it against key UI/UX guidelines.")
    
    screenshot_file = st.file_uploader("Upload screenshot", type=["png", "jpg", "jpeg", "webp"], key="screenshot_l1")
    
    if screenshot_file:
        if st.button("🚀 Run Design Audit", use_container_width=True):
            with st.spinner("Analyzing image layout and checking design rules..."):
                try:
                    files = {"screenshot": (screenshot_file.name, screenshot_file.getvalue(), screenshot_file.type)}
                    res = requests.post("http://localhost:3001/api/analyze", files=files)
                    
                    if res.status_code == 200:
                        report = res.json()
                        st.session_state["l1_report"] = report
                        st.success("Analysis complete!")
                    else:
                        st.error(f"Analysis failed: {res.text}")
                except Exception as e:
                    st.error(f"Failed to connect to backend: {str(e)}")
                    
        if "l1_report" in st.session_state:
            report = st.session_state["l1_report"]
            
            # Display Score card
            score = report["summary"]["overallScore"]
            grade = report["summary"]["grade"]
            grade_label = report["summary"]["gradeLabel"]
            grade_emoji = report["summary"]["gradeEmoji"]
            
            st.markdown(f'<div class="verdict-header verdict-neutral">DESIGN SCORE: {score}/100 ({grade_label} {grade_emoji})</div>', unsafe_allow_html=True)
            
            # Breakdown
            stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
            with stat_col1:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Critical 🚨</h4><h2 style="margin:5px 0 0 0; color:#ff3b30;">{report["summary"].get("critical", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col2:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">High 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff9500;">{report["summary"].get("high", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col3:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Medium 🟡</h4><h2 style="margin:5px 0 0 0; color:#ffcc00;">{report["summary"].get("medium", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col4:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Low/Info 🔵</h4><h2 style="margin:5px 0 0 0; color:#007aff;">{report["summary"].get("low", 0) + report["summary"].get("info", 0)}</h2></div>', unsafe_allow_html=True)
                
            st.markdown("### Detailed Findings Report")
            findings = report.get("findings", [])
            if len(findings) == 0:
                st.info("No issues found! Your design is excellent.")
            else:
                for idx, finding in enumerate(findings):
                    sev = finding["severity"].lower()
                    if sev in ["critical", "high"]:
                        badge_color = "#ff3b30"
                        badge_bg = "#ffebe9"
                    elif sev == "medium":
                        badge_color = "#ff9500"
                        badge_bg = "#fff4e5"
                    else:
                        badge_color = "#007aff"
                        badge_bg = "#e8f2ff"
                        
                    badge_style = f"color:{badge_color}; background-color:{badge_bg}; border: 1px solid {badge_color};"
                    
                    with st.expander(f"Finding #{idx+1} — [{finding['principle']}] {finding['description'][:80]}...", expanded=True):
                        col_det1, col_det2 = st.columns([3, 1])
                        with col_det1:
                            st.markdown(f"**Description:** {finding['description']}")
                            st.markdown(f"**User Impact:** {finding['userImpact']}")
                            st.markdown(f"**Recommendation:** {finding['recommendation']}")
                            st.caption(f"📍 **Location:** {finding['location']}")
                        with col_det2:
                            st.markdown(f'<div class="badge" style="{badge_style}">{finding["severity"].upper()}</div>', unsafe_allow_html=True)
                            st.metric("Confidence", f"{finding['confidence']}%")
                            
            st.markdown("---")
            st.markdown("### Reports and Export")
            st.download_button(
                label="📥 Download JSON Audit Report",
                data=json.dumps(report, indent=2),
                file_name="aivar_design_audit_report.json",
                mime="application/json",
                use_container_width=True
            )

elif audit_level == "Level 3: Autonomous Site Audit":
    st.subheader("🌐 Level 3: Autonomous Live Site Audit")
    col_url1, col_url2 = st.columns(2)
    with col_url1:
        baseline_url = st.text_input("Baseline URL (Before)")
    with col_url2:
        current_url = st.text_input("Current URL (After)")
        
    if st.button("🚀 Run Autonomous Audit", use_container_width=True):
        if not baseline_url or not current_url:
            st.error("Please enter both URLs.")
        else:
            with st.spinner("Initializing Playwright crawler and navigating to sites..."):
                try:
                    res = requests.post("http://localhost:3001/api/audit-site", json={
                        "baselineUrl": baseline_url,
                        "currentUrl": current_url,
                        "diffThreshold": diff_threshold,
                        "minArea": min_area
                    })
                    
                    if res.status_code == 200:
                        report = res.json()
                        st.session_state["report"] = report
                        
                        # Fetch the annotated image from the node server
                        img_url = f"http://localhost:3001{report['annotatedImageUrl']}"
                        img_data = requests.get(img_url).content
                        nparr = np.frombuffer(img_data, np.uint8)
                        annotated_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        st.session_state["annotated_img"] = annotated_img
                        st.success("Audit complete!")
                    else:
                        st.error(f"Audit failed: {res.text}")
                except Exception as e:
                    st.error(f"Failed to connect to Node.js backend for crawler: {str(e)}")
                    
    # Render Results if available in session state
    if "report" in st.session_state and "annotated_img" in st.session_state:
        report = st.session_state["report"]
        annotated_img = st.session_state["annotated_img"]
        
        # Display Verdict Summary
        verdict = report["overall_verdict"].upper()
        verdict_class = f"verdict-{report['overall_verdict']}"
        
        st.markdown(f'<div class="verdict-header {verdict_class}">OVERALL VERDICT: {verdict}</div>', unsafe_allow_html=True)
        
        # Stats Columns
        stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
        with stat_col1:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Regressions 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff3b30;">{report["summary"]["regressions"]}</h2></div>', unsafe_allow_html=True)
        with stat_col2:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Improvements 🟢</h4><h2 style="margin:5px 0 0 0; color:#34c759;">{report["summary"]["improvements"]}</h2></div>', unsafe_allow_html=True)
        with stat_col3:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Neutral changes 🟡</h4><h2 style="margin:5px 0 0 0; color:#8e8e93;">{report["summary"]["neutral"]}</h2></div>', unsafe_allow_html=True)
        with stat_col4:
            total_diffs = len(report["differences"])
            st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Total Differences</h4><h2 style="margin:5px 0 0 0; color:#007aff;">{total_diffs}</h2></div>', unsafe_allow_html=True)
            
        st.markdown("### Side-by-Side Visual Comparison")
        
        col_img1, col_img2 = st.columns(2)
        with col_img1:
            st.markdown("**Baseline (Before)**")
            st.info("Visualizing crawled baseline screenshot...")
        with col_img2:
            st.markdown("**Current (After) with Difference Highlights**")
            annotated_rgb = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
            st.image(annotated_rgb, use_container_width=True)
            
        st.markdown("### Detailed Findings Report")
        
        if len(report["differences"]) == 0:
            st.info("No visual differences detected between the baseline and current sites.")
        else:
            for idx, diff in enumerate(report["differences"]):
                loc = diff["location"]
                loc_str = f"x: {loc['x']}px, y: {loc['y']}px, size: {loc['width']}x{loc['height']}px"
                badge_type = f"badge-{diff['classification']}"
                
                with st.expander(f"Difference #{idx+1} — {diff['what_changed'][:80]}...", expanded=True):
                    col_det1, col_det2 = st.columns([3, 1])
                    with col_det1:
                        st.markdown(f"**What Changed:** {diff['what_changed']}")
                        st.markdown(f"**User Impact:** {diff['user_impact']}")
                        st.caption(f"📍 **Location:** {loc_str}")
                    with col_det2:
                        st.markdown(f'<div class="badge {badge_type}">{diff["classification"].upper()}</div>', unsafe_allow_html=True)
                        st.metric("Confidence Score", f"{int(diff['confidence_score'] * 100)}%")
                        
        st.markdown("---")
        st.markdown("### Reports and Export")
        
        report_json_str = json.dumps(report, indent=2)
        success_enc, encoded_img = cv2.imencode('.png', annotated_img)
        
        col_dl1, col_dl2 = st.columns(2)
        with col_dl1:
            st.download_button(
                label="📥 Download JSON Report",
                data=report_json_str,
                file_name="aivar_design_report.json",
                mime="application/json",
                use_container_width=True
            )
        with col_dl2:
            if success_enc:
                st.download_button(
                    label="📥 Download Annotated Visual Diff Image",
                    data=encoded_img.tobytes(),
                    file_name="aivar_annotated_diff.png",
                    mime="image/png",
                    use_container_width=True
                )

else:
    # Original Level 2 Workspace
    col_upload1, col_upload2 = st.columns(2)

    with col_upload1:
        st.subheader("1. Baseline (Before) Image")
        baseline_file = st.file_uploader("Upload baseline screenshot", type=["png", "jpg", "jpeg", "webp"], key="baseline")

    with col_upload2:
        st.subheader("2. Current (After) Image")
        current_file = st.file_uploader("Upload current screenshot", type=["png", "jpg", "jpeg", "webp"], key="current")

    # Run Analysis Trigger
    if baseline_file and current_file:
        # Ensure temporary upload directory exists
        temp_dir = "uploads"
        os.makedirs(temp_dir, exist_ok=True)
        
        baseline_path = os.path.join(temp_dir, "temp_baseline.png")
        current_path = os.path.join(temp_dir, "temp_current.png")
        
        # Write uploaded files temporarily to disk
        with open(baseline_path, "wb") as f:
            f.write(baseline_file.getbuffer())
        with open(current_path, "wb") as f:
            f.write(current_file.getbuffer())
            
        st.markdown("---")
        
        if st.button("🚀 Run Visual Regression Analysis", use_container_width=True):
            with st.spinner("Analyzing layouts and executing OpenCV/Gemini audits..."):
                try:
                    report, annotated_img = analyze_visual_regression(
                        baseline_path, current_path, 
                        api_key=api_key, 
                        diff_threshold=diff_threshold, 
                        min_area=min_area
                    )
                    
                    st.session_state["report"] = report
                    st.session_state["annotated_img"] = annotated_img
                    st.success("Analysis complete!")
                    
                except Exception as e:
                    st.error(f"Analysis failed: {str(e)}")
                    
        # Render Results if available in session state
        if "report" in st.session_state and "annotated_img" in st.session_state:
            report = st.session_state["report"]
            annotated_img = st.session_state["annotated_img"]
            
            # Display Verdict Summary
            verdict = report["overall_verdict"].upper()
            verdict_class = f"verdict-{report['overall_verdict']}"
            
            st.markdown(f'<div class="verdict-header {verdict_class}">OVERALL VERDICT: {verdict}</div>', unsafe_allow_html=True)
            
            # Stats Columns
            stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
            with stat_col1:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Regressions 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff3b30;">{report["summary"]["regressions"]}</h2></div>', unsafe_allow_html=True)
            with stat_col2:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Improvements 🟢</h4><h2 style="margin:5px 0 0 0; color:#34c759;">{report["summary"]["improvements"]}</h2></div>', unsafe_allow_html=True)
            with stat_col3:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Neutral changes 🟡</h4><h2 style="margin:5px 0 0 0; color:#8e8e93;">{report["summary"]["neutral"]}</h2></div>', unsafe_allow_html=True)
            with stat_col4:
                total_diffs = len(report["differences"])
                st.markdown(f'<div class="metric-card"><h4 style="margin:0;">Total Differences</h4><h2 style="margin:5px 0 0 0; color:#007aff;">{total_diffs}</h2></div>', unsafe_allow_html=True)
                
            st.markdown("### Side-by-Side Visual Comparison")
            
            col_img1, col_img2 = st.columns(2)
            with col_img1:
                st.markdown("**Baseline (Before)**")
                st.image(baseline_path, use_container_width=True)
            with col_img2:
                st.markdown("**Current (After) with Difference Highlights**")
                # Convert BGR (OpenCV) to RGB for Streamlit image rendering
                annotated_rgb = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
                st.image(annotated_rgb, use_container_width=True)
                
            st.markdown("### Detailed Findings Report")
            
            if len(report["differences"]) == 0:
                st.info("No visual differences detected between the baseline and current screenshots based on the sensitivity thresholds.")
            else:
                for idx, diff in enumerate(report["differences"]):
                    loc = diff["location"]
                    loc_str = f"x: {loc['x']}px, y: {loc['y']}px, size: {loc['width']}x{loc['height']}px"
                    
                    badge_type = f"badge-{diff['classification']}"
                    
                    # Render finding card
                    with st.expander(f"Difference #{idx+1} — {diff['what_changed'][:80]}...", expanded=True):
                        col_det1, col_det2 = st.columns([3, 1])
                        with col_det1:
                            st.markdown(f"**What Changed:** {diff['what_changed']}")
                            st.markdown(f"**User Impact:** {diff['user_impact']}")
                            st.caption(f"📍 **Location:** {loc_str}")
                        with col_det2:
                            st.markdown(f'<div class="badge {badge_type}">{diff["classification"].upper()}</div>', unsafe_allow_html=True)
                            st.metric("Confidence Score", f"{int(diff['confidence_score'] * 100)}%")
                            
            st.markdown("---")
            st.markdown("### Reports and Export")
            
            # Download files
            report_json_str = json.dumps(report, indent=2)
            
            # Visual diff download image buffer
            success_enc, encoded_img = cv2.imencode('.png', annotated_img)
            
            col_dl1, col_dl2 = st.columns(2)
            with col_dl1:
                st.download_button(
                    label="📥 Download JSON Report",
                    data=report_json_str,
                    file_name="aivar_design_report.json",
                    mime="application/json",
                    use_container_width=True
                )
            with col_dl2:
                if success_enc:
                    st.download_button(
                        label="📥 Download Annotated Visual Diff Image",
                        data=encoded_img.tobytes(),
                        file_name="aivar_annotated_diff.png",
                        mime="image/png",
                        use_container_width=True
                    )
    else:
        st.info("Please upload both a Baseline image and a Current image to start the Visual Regression Audit.")
