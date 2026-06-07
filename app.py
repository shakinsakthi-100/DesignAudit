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
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    /* Apply modern Outfit font to entire Streamlit app */
    html, body, [class*="css"], .stMarkdown, .stText, .stButton, button, p, span, h1, h2, h3, h4, h5, h6 {
        font-family: 'Outfit', sans-serif !important;
    }

    /* Overall page background */
    .stApp {
        background: radial-gradient(circle at top right, #131722, #0d0f14) !important;
        color: #e1e2e7 !important;
    }
    
    /* Main block container padding */
    .main .block-container {
        padding-top: 3rem !important;
        padding-bottom: 3rem !important;
        max-width: 90% !important;
    }

    /* Glassmorphism sidebar */
    [data-testid="stSidebar"] {
        background-color: rgba(15, 20, 35, 0.7) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
        backdrop-filter: blur(12px) !important;
    }

    /* Sidebar divider */
    [data-testid="stSidebar"] hr {
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    }

    /* Glowing Gradient Title Text */
    .glow-text {
        background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
    }

    /* Tabs Custom Styling */
    .stTabs [data-baseweb="tab-list"] {
        background: rgba(255, 255, 255, 0.02) !important;
        padding: 6px !important;
        border-radius: 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        gap: 8px !important;
    }
    
    .stTabs [data-baseweb="tab"] {
        padding: 10px 20px !important;
        border-radius: 8px !important;
        background-color: transparent !important;
        color: #8a8d9a !important;
        font-weight: 600 !important;
        border: none !important;
        transition: all 0.3s ease !important;
    }
    
    .stTabs [data-baseweb="tab"]:hover {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.04) !important;
    }
    
    .stTabs [aria-selected="true"] {
        color: #00F2FE !important;
        background: rgba(0, 242, 254, 0.1) !important;
        border: 1px solid rgba(0, 242, 254, 0.2) !important;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.05) !important;
    }
    
    /* Remove default underline of selected tabs */
    .stTabs [data-baseweb="tab-highlight"] {
        background-color: transparent !important;
    }

    /* Glassmorphic Metric Cards */
    .metric-card {
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(8px);
        padding: 20px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        transition: transform 0.2s, border-color 0.2s;
        text-align: center;
    }
    
    .metric-card:hover {
        transform: translateY(-4px);
        border-color: rgba(0, 242, 254, 0.2);
        box-shadow: 0 12px 40px 0 rgba(0, 242, 254, 0.05);
    }

    /* Custom premium buttons */
    .stButton>button {
        background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%) !important;
        color: #0c0f18 !important;
        font-weight: 700 !important;
        border: none !important;
        padding: 12px 24px !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 15px rgba(0, 242, 254, 0.2) !important;
        transition: all 0.3s ease !important;
        width: 100% !important;
    }
    
    .stButton>button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(0, 242, 254, 0.4) !important;
        color: #0c0f18 !important;
    }
    
    .stButton>button:active {
        transform: translateY(0px) !important;
    }

    /* Styled Dropzones & Uploaders */
    [data-testid="stFileUploader"] {
        border: 2px dashed rgba(255, 255, 255, 0.1) !important;
        border-radius: 16px !important;
        background: rgba(255, 255, 255, 0.01) !important;
        padding: 16px !important;
        transition: border-color 0.3s;
    }
    
    [data-testid="stFileUploader"]:hover {
        border-color: #00F2FE !important;
    }

    /* Glowing Badge definitions */
    .badge {
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        display: inline-block;
        letter-spacing: 0.5px;
    }
    .badge-regression {
        background-color: rgba(255, 59, 48, 0.12) !important;
        color: #ff453a !important;
        border: 1px solid rgba(255, 59, 48, 0.3) !important;
        box-shadow: 0 0 8px rgba(255, 59, 48, 0.1);
    }
    .badge-improvement {
        background-color: rgba(52, 199, 89, 0.12) !important;
        color: #30d158 !important;
        border: 1px solid rgba(52, 199, 89, 0.3) !important;
        box-shadow: 0 0 8px rgba(52, 199, 89, 0.1);
    }
    .badge-neutral {
        background-color: rgba(142, 142, 147, 0.12) !important;
        color: #98989d !important;
        border: 1px solid rgba(142, 142, 147, 0.3) !important;
    }

    /* Verdict Headers */
    .verdict-header {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 24px;
        padding: 16px 24px;
        border-radius: 16px;
        text-align: center;
        letter-spacing: 1px;
    }
    .verdict-regression {
        background: linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 69, 58, 0.05) 100%) !important;
        color: #ff453a !important;
        border: 1px solid rgba(255, 59, 48, 0.3) !important;
        box-shadow: 0 0 20px rgba(255, 59, 48, 0.05);
    }
    .verdict-improvement {
        background: linear-gradient(135deg, rgba(52, 199, 89, 0.15) 0%, rgba(48, 209, 88, 0.05) 100%) !important;
        color: #30d158 !important;
        border: 1px solid rgba(52, 199, 89, 0.3) !important;
        box-shadow: 0 0 20px rgba(52, 199, 89, 0.05);
    }
    .verdict-neutral {
        background: linear-gradient(135deg, rgba(142, 142, 147, 0.15) 0%, rgba(150, 150, 155, 0.05) 100%) !important;
        color: #98989d !important;
        border: 1px solid rgba(142, 142, 147, 0.3) !important;
    }

    /* Footer styling */
    .footer {
        text-align: center;
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        color: #626575;
        font-size: 14px;
    }
</style>
""", unsafe_allow_html=True)

# Centered Premium Title Header
st.markdown("""
<div style="text-align: center; margin-bottom: 2.5rem;">
    <h1 class="glow-text" style="font-size: 2.8rem; margin-bottom: 0.5rem; letter-spacing: 0.5px;">🔍 AIVAR Design Audit</h1>
    <p style="font-size: 1.1rem; color: #8a8d9a; max-width: 600px; margin: 0 auto;">Autonomous visual design quality control, visual hierarchy analysis & regression review agent.</p>
</div>
""", unsafe_allow_html=True)

# Sidebar Configuration (Simplified and Premium)
st.sidebar.image("https://img.icons8.com/isometric-line/100/visible.png", width=80)
st.sidebar.title("AIVAR")
st.sidebar.caption("UI/UX Design Review & Visual Audit Agent")
st.sidebar.markdown("""
---
🔍 **Capabilities:**
- Visual Hierarchy Evaluation
- Spacing & Margin Consistency
- Grid & Alignment Quality
- WCAG AA Contrast Testing
- Cross-version Regression Tracking

💡 **Info:**
This dashboard integrates local OpenCV visual difference matching with cloud Vision models to audit your UI screenshots.
""")

# Default parameters (Hidden from UI for a cleaner workspace)
api_key = os.environ.get("OPENAI_API_KEY", "")
diff_threshold = 15
min_area = 80

import requests

# Tabbed Dashboard Layout
tab1, tab2, tab3 = st.tabs([
    "🌐 Level 1: Single Page Audit", 
    "🔄 Level 2: Visual Regression", 
    "🤖 Level 3: Autonomous Site Audit"
])

# ==================== TAB 1: LEVEL 1 AUDIT ====================
with tab1:
    st.subheader("🌐 Level 1: Single Page Design Audit")
    st.caption("Upload a single screenshot or mockup to evaluate it against key UI/UX guidelines.")
    
    screenshot_file = st.file_uploader("Upload screenshot", type=["png", "jpg", "jpeg", "webp"], key="screenshot_l1")
    
    if screenshot_file:
        if st.button("🚀 Run Design Audit", use_container_width=True, key="run_l1_audit"):
            with st.spinner("Analyzing image layout and checking design rules..."):
                try:
                    files = {"screenshot": (screenshot_file.name, screenshot_file.getvalue(), screenshot_file.type)}
                    res = requests.post("http://localhost:3001/api/analyze", files=files)
                    
                    if res.status_code == 200:
                        st.session_state["l1_report"] = res.json()
                        st.success("Analysis complete!")
                    else:
                        st.error(f"Analysis failed: {res.text}")
                except Exception as e:
                    st.error(f"Failed to connect to backend: {str(e)}")
                    
        if "l1_report" in st.session_state:
            report = st.session_state["l1_report"]
            
            # Display Score card
            score = report["summary"]["overallScore"]
            grade_label = report["summary"]["gradeLabel"]
            grade_emoji = report["summary"]["gradeEmoji"]
            
            st.markdown(f'<div class="verdict-header verdict-neutral">DESIGN SCORE: {score}/100 ({grade_label} {grade_emoji})</div>', unsafe_allow_html=True)
            
            # Breakdown
            stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
            with stat_col1:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#ff453a;">Critical 🚨</h4><h2 style="margin:5px 0 0 0; color:#ff453a;">{report["summary"].get("critical", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col2:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#ff9f0a;">High 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff9f0a;">{report["summary"].get("high", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col3:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#ffd60a;">Medium 🟡</h4><h2 style="margin:5px 0 0 0; color:#ffd60a;">{report["summary"].get("medium", 0)}</h2></div>', unsafe_allow_html=True)
            with stat_col4:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#64d2ff;">Low/Info 🔵</h4><h2 style="margin:5px 0 0 0; color:#64d2ff;">{report["summary"].get("low", 0) + report["summary"].get("info", 0)}</h2></div>', unsafe_allow_html=True)
                
            st.markdown("### Detailed Findings Report")
            findings = report.get("findings", [])
            if len(findings) == 0:
                st.info("No issues found! Your design is excellent.")
            else:
                for idx, finding in enumerate(findings):
                    sev = finding["severity"].lower()
                    if sev == "critical":
                        border_color = "#ff453a"
                        glow = "rgba(255, 69, 58, 0.12)"
                    elif sev == "high":
                        border_color = "#ff9f0a"
                        glow = "rgba(255, 159, 10, 0.12)"
                    elif sev == "medium":
                        border_color = "#ffd60a"
                        glow = "rgba(253, 214, 10, 0.12)"
                    elif sev == "low":
                        border_color = "#64d2ff"
                        glow = "rgba(100, 210, 255, 0.12)"
                    else:
                        border_color = "#bf5af2"
                        glow = "rgba(191, 90, 242, 0.12)"
                        
                    st.markdown(f"""
                    <div style="
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-left: 5px solid {border_color};
                        box-shadow: 0 4px 20px {glow};
                        padding: 22px;
                        border-radius: 12px;
                        margin-bottom: 18px;
                        backdrop-filter: blur(4px);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 700; font-size: 16px; color: #ffffff;">Finding — {finding['principle']}</span>
                            <span style="
                                font-size: 10px;
                                font-weight: 700;
                                color: {border_color};
                                background: {glow};
                                border: 1px solid {border_color};
                                padding: 3px 10px;
                                border-radius: 6px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">{finding['severity'].upper()}</span>
                        </div>
                        <div style="color: #e1e2e7; font-size: 14.5px; margin-bottom: 12px; line-height: 1.5;">
                            <strong>Description:</strong> {finding['description']}
                        </div>
                        <div style="color: #a1a2a7; font-size: 13.5px; margin-bottom: 8px; line-height: 1.4;">
                            <strong>User Impact:</strong> {finding['userImpact']}
                        </div>
                        <div style="color: #64d2ff; font-size: 13.5px; margin-bottom: 10px; line-height: 1.4;">
                            <strong>Recommendation:</strong> {finding['recommendation']}
                        </div>
                        <div style="color: #8e919f; font-size: 12px; display: flex; gap: 15px; border-top: 1px solid rgba(255, 255, 255, 0.04); padding-top: 8px; margin-top: 8px;">
                            <span>📍 <strong>Location:</strong> {finding['location']}</span>
                            <span>🎯 <strong>Confidence:</strong> {finding['confidence']}%</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                            
            st.markdown("---")
            st.markdown("### Reports and Export")
            st.download_button(
                label="📥 Download JSON Audit Report",
                data=json.dumps(report, indent=2),
                file_name="aivar_design_audit_report.json",
                mime="application/json",
                key="dl_l1_json",
                use_container_width=True
            )

# ==================== TAB 2: LEVEL 2 AUDIT ====================
with tab2:
    st.subheader("🔄 Level 2: Visual Regression comparison")
    st.caption("Upload baseline and current screenshots to detect and verify layout regressions.")
    
    col_upload1, col_upload2 = st.columns(2)
    with col_upload1:
        baseline_file = st.file_uploader("Upload baseline screenshot", type=["png", "jpg", "jpeg", "webp"], key="baseline_l2")
    with col_upload2:
        current_file = st.file_uploader("Upload current screenshot", type=["png", "jpg", "jpeg", "webp"], key="current_l2")
        
    if baseline_file and current_file:
        temp_dir = "uploads"
        os.makedirs(temp_dir, exist_ok=True)
        baseline_path = os.path.join(temp_dir, "temp_baseline.png")
        current_path = os.path.join(temp_dir, "temp_current.png")
        
        with open(baseline_path, "wb") as f:
            f.write(baseline_file.getbuffer())
        with open(current_path, "wb") as f:
            f.write(current_file.getbuffer())
            
        if st.button("🚀 Run Visual Regression Analysis", use_container_width=True, key="run_l2_audit"):
            with st.spinner("Analyzing layouts and executing OpenCV/Gemini audits..."):
                try:
                    report, annotated_img = analyze_visual_regression(
                        baseline_path, current_path, 
                        api_key=api_key, 
                        diff_threshold=diff_threshold, 
                        min_area=min_area
                    )
                    st.session_state["l2_report"] = report
                    st.session_state["l2_annotated_img"] = annotated_img
                    st.success("Analysis complete!")
                except Exception as e:
                    st.error(f"Analysis failed: {str(e)}")
                    
        if "l2_report" in st.session_state and "l2_annotated_img" in st.session_state:
            report = st.session_state["l2_report"]
            annotated_img = st.session_state["l2_annotated_img"]
            
            verdict = report["overall_verdict"].upper()
            verdict_class = f"verdict-{report['overall_verdict']}"
            
            st.markdown(f'<div class="verdict-header {verdict_class}">OVERALL VERDICT: {verdict}</div>', unsafe_allow_html=True)
            
            stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
            with stat_col1:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#ff453a;">Regressions 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff453a;">{report["summary"]["regressions"]}</h2></div>', unsafe_allow_html=True)
            with stat_col2:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#30d158;">Improvements 🟢</h4><h2 style="margin:5px 0 0 0; color:#30d158;">{report["summary"]["improvements"]}</h2></div>', unsafe_allow_html=True)
            with stat_col3:
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#98989d;">Neutral changes 🟡</h4><h2 style="margin:5px 0 0 0; color:#98989d;">{report["summary"]["neutral"]}</h2></div>', unsafe_allow_html=True)
            with stat_col4:
                total_diffs = len(report["differences"])
                st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#4FACFE;">Total Differences</h4><h2 style="margin:5px 0 0 0; color:#4FACFE;">{total_diffs}</h2></div>', unsafe_allow_html=True)
                
            st.markdown("### Side-by-Side Visual Comparison")
            col_img1, col_img2 = st.columns(2)
            with col_img1:
                st.markdown("**Baseline (Before)**")
                st.image(baseline_path, use_container_width=True)
            with col_img2:
                st.markdown("**Current (After) with Difference Highlights**")
                annotated_rgb = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
                st.image(annotated_rgb, use_container_width=True)
                
            st.markdown("### Detailed Findings Report")
            if len(report["differences"]) == 0:
                st.info("No visual differences detected between baseline and current screenshots.")
            else:
                for idx, diff in enumerate(report["differences"]):
                    loc = diff["location"]
                    loc_str = f"x: {loc['x']}px, y: {loc['y']}px, size: {loc['width']}x{loc['height']}px"
                    classif = diff["classification"].lower()
                    
                    if classif == "regression":
                        border_color = "#ff453a"
                        glow = "rgba(255, 69, 58, 0.12)"
                        badge_label = "Regression 🔴"
                    elif classif == "improvement":
                        border_color = "#30d158"
                        glow = "rgba(48, 209, 88, 0.12)"
                        badge_label = "Improvement 🟢"
                    else:
                        border_color = "#98989d"
                        glow = "rgba(152, 152, 157, 0.12)"
                        badge_label = "Neutral 🟡"
                        
                    st.markdown(f"""
                    <div style="
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-left: 5px solid {border_color};
                        box-shadow: 0 4px 20px {glow};
                        padding: 22px;
                        border-radius: 12px;
                        margin-bottom: 18px;
                        backdrop-filter: blur(4px);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 700; font-size: 16px; color: #ffffff;">Difference #{idx+1}</span>
                            <span style="
                                font-size: 10px;
                                font-weight: 700;
                                color: {border_color};
                                background: {glow};
                                border: 1px solid {border_color};
                                padding: 3px 10px;
                                border-radius: 6px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">{badge_label}</span>
                        </div>
                        <div style="color: #e1e2e7; font-size: 14.5px; margin-bottom: 8px; line-height: 1.5;">
                            <strong>What Changed:</strong> {diff['what_changed']}
                        </div>
                        <div style="color: #a1a2a7; font-size: 13.5px; margin-bottom: 10px; line-height: 1.4;">
                            <strong>User Impact:</strong> {diff['user_impact']}
                        </div>
                        <div style="color: #8e919f; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.04); padding-top: 8px; display: flex; gap: 15px;">
                            <span>📍 <strong>Location:</strong> {loc_str}</span>
                            <span>🎯 <strong>Confidence Score:</strong> {int(diff['confidence_score'] * 100)}%</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                            
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
                    key="dl_l2_json",
                    use_container_width=True
                )
            with col_dl2:
                if success_enc:
                    st.download_button(
                        label="📥 Download Annotated Visual Diff Image",
                        data=encoded_img.tobytes(),
                        file_name="aivar_annotated_diff.png",
                        mime="image/png",
                        key="dl_l2_img",
                        use_container_width=True
                    )
    else:
        st.info("Please upload both a Baseline image and a Current image to start the Visual Regression Audit.")

# ==================== TAB 3: LEVEL 3 AUDIT ====================
with tab3:
    st.subheader("🤖 Level 3: Autonomous Site Audit")
    st.caption("Enter two URLs to launch an autonomous crawler, capture screenshots, and audit visual changes.")
    
    col_url1, col_url2 = st.columns(2)
    with col_url1:
        baseline_url = st.text_input("Baseline URL (Before)", key="baseline_url_l3")
    with col_url2:
        current_url = st.text_input("Current URL (After)", key="current_url_l3")
        
    if st.button("🚀 Run Autonomous Audit", use_container_width=True, key="run_l3_audit"):
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
                        st.session_state["l3_report"] = report
                        
                        img_url = f"http://localhost:3001{report['annotatedImageUrl']}"
                        img_data = requests.get(img_url).content
                        nparr = np.frombuffer(img_data, np.uint8)
                        st.session_state["l3_annotated_img"] = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        st.success("Audit complete!")
                    else:
                        st.error(f"Audit failed: {res.text}")
                except Exception as e:
                    st.error(f"Failed to connect to backend: {str(e)}")
                    
    if "l3_report" in st.session_state and "l3_annotated_img" in st.session_state:
        report = st.session_state["l3_report"]
        annotated_img = st.session_state["l3_annotated_img"]
        
        verdict = report["overall_verdict"].upper()
        verdict_class = f"verdict-{report['overall_verdict']}"
        
        st.markdown(f'<div class="verdict-header {verdict_class}">OVERALL VERDICT: {verdict}</div>', unsafe_allow_html=True)
        
        stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
        with stat_col1:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#ff453a;">Regressions 🔴</h4><h2 style="margin:5px 0 0 0; color:#ff453a;">{report["summary"]["regressions"]}</h2></div>', unsafe_allow_html=True)
        with stat_col2:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#30d158;">Improvements 🟢</h4><h2 style="margin:5px 0 0 0; color:#30d158;">{report["summary"]["improvements"]}</h2></div>', unsafe_allow_html=True)
        with stat_col3:
            st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#98989d;">Neutral changes 🟡</h4><h2 style="margin:5px 0 0 0; color:#98989d;">{report["summary"]["neutral"]}</h2></div>', unsafe_allow_html=True)
        with stat_col4:
            total_diffs = len(report["differences"])
            st.markdown(f'<div class="metric-card"><h4 style="margin:0; color:#4FACFE;">Total Differences</h4><h2 style="margin:5px 0 0 0; color:#4FACFE;">{total_diffs}</h2></div>', unsafe_allow_html=True)
            
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
            st.info("No visual differences detected between crawled baseline and current screenshots.")
        else:
            for idx, diff in enumerate(report["differences"]):
                loc = diff["location"]
                loc_str = f"x: {loc['x']}px, y: {loc['y']}px, size: {loc['width']}x{loc['height']}px"
                classif = diff["classification"].lower()
                
                if classif == "regression":
                    border_color = "#ff453a"
                    glow = "rgba(255, 69, 58, 0.12)"
                    badge_label = "Regression 🔴"
                elif classif == "improvement":
                    border_color = "#30d158"
                    glow = "rgba(48, 209, 88, 0.12)"
                    badge_label = "Improvement 🟢"
                else:
                    border_color = "#98989d"
                    glow = "rgba(152, 152, 157, 0.12)"
                    badge_label = "Neutral 🟡"
                    
                st.markdown(f"""
                <div style="
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-left: 5px solid {border_color};
                    box-shadow: 0 4px 20px {glow};
                    padding: 22px;
                    border-radius: 12px;
                    margin-bottom: 18px;
                    backdrop-filter: blur(4px);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-weight: 700; font-size: 16px; color: #ffffff;">Difference #{idx+1}</span>
                        <span style="
                            font-size: 10px;
                            font-weight: 700;
                            color: {border_color};
                            background: {glow};
                            border: 1px solid {border_color};
                            padding: 3px 10px;
                            border-radius: 6px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        ">{badge_label}</span>
                    </div>
                    <div style="color: #e1e2e7; font-size: 14.5px; margin-bottom: 8px; line-height: 1.5;">
                        <strong>What Changed:</strong> {diff['what_changed']}
                    </div>
                    <div style="color: #a1a2a7; font-size: 13.5px; margin-bottom: 10px; line-height: 1.4;">
                        <strong>User Impact:</strong> {diff['user_impact']}
                    </div>
                    <div style="color: #8e919f; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.04); padding-top: 8px; display: flex; gap: 15px;">
                        <span>📍 <strong>Location:</strong> {loc_str}</span>
                        <span>🎯 <strong>Confidence Score:</strong> {int(diff['confidence_score'] * 100)}%</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                        
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
                key="dl_l3_json",
                use_container_width=True
            )
        with col_dl2:
            if success_enc:
                st.download_button(
                    label="📥 Download Annotated Visual Diff Image",
                    data=encoded_img.tobytes(),
                    file_name="aivar_annotated_diff.png",
                    mime="image/png",
                    key="dl_l3_img",
                    use_container_width=True
                )

# Centered Premium Footer
st.markdown("""
<div class="footer">
    🔍 AIVAR Design Audit Dashboard • Powered by OpenCV, Playwright & Vision Models
</div>
""", unsafe_allow_html=True)
