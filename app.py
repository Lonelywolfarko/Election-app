"""
Election Guide Assistant - Flask Backend
========================================
A hackathon-ready election guidance web application.
Provides eligibility checking, step-by-step guidance, and a rule-based chat assistant.
"""

import json
import os
from flask import Flask, request, jsonify, render_template

# ─── App Setup ───────────────────────────────────────────────────────────────
app = Flask(__name__)

# Path to the election data JSON file
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "election_data.json")


def load_data():
    """Load election data from the JSON file."""
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ─── Global State for Hackathon Demo ─────────────────────────────────────────
# For a production app, we would use sessions or a database.
CURRENT_STAGE_INDEX = 0

JOURNEY_STAGES = [
    "Not Started",
    "Eligibility Checked",
    "Voter Registration Completed",
    "Ready to Vote"
]

MOTIVATIONS = [
    "Let's get started on your voting journey!",
    "Great! You are eligible. Next step is registration.",
    "Registration complete! You are almost there.",
    "You're all set! Make your voice heard on election day."
]

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/check-eligibility", methods=["POST"])
def check_eligibility():
    """
    POST /check-eligibility
    Body: { "age": <int> }
    Returns eligibility status and next step guidance.
    """
    body = request.get_json()

    # Validate input
    if not body or "age" not in body:
        return jsonify({"error": "Please provide an age."}), 400

    try:
        age = int(body["age"])
    except (ValueError, TypeError):
        return jsonify({"error": "Age must be a valid number."}), 400

    if age < 0 or age > 120:
        return jsonify({"error": "Please enter a realistic age between 0 and 120."}), 400

    data = load_data()
    min_age = data["election_info"]["minimum_voting_age"]

    global CURRENT_STAGE_INDEX

    if age >= min_age:
        # Update stage to 'Eligibility Checked' if currently 'Not Started'
        if CURRENT_STAGE_INDEX == 0:
            CURRENT_STAGE_INDEX = 1
        
        # User is eligible
        response = {
            "eligible": True,
            "message": f"🎉 Great news! At {age} years old, you are eligible to vote.",
            "next_step": {
                "title": "Register for Voter ID",
                "description": "Your next step is to register your Voter ID (EPIC) on the Election Commission of India portal.",
                "action_url": "https://voters.eci.gov.in",
                "action_label": "Register at ECI Portal"
            },
            "years_voting": age - min_age
        }
    else:
        # Reset stage if user is under 18
        CURRENT_STAGE_INDEX = 0
        
        # User is not eligible yet
        years_remaining = min_age - age
        response = {
            "eligible": False,
            "message": f"You are {age} years old. You need to be at least {min_age} years old to vote in India.",
            "next_step": {
                "title": f"Come back in {years_remaining} year{'s' if years_remaining > 1 else ''}",
                "description": f"You'll be eligible to vote when you turn {min_age}. You can pre-register closer to your 18th birthday.",
                "action_url": "https://eci.gov.in",
                "action_label": "Learn About Elections"
            },
            "years_remaining": years_remaining
        }

    return jsonify(response)


@app.route("/api/journey", methods=["GET"])
def get_journey():
    """
    GET /api/journey
    Returns the current progression state of the voting journey.
    """
    stages_response = []
    
    for i, stage_name in enumerate(JOURNEY_STAGES):
        if i < CURRENT_STAGE_INDEX:
            status = "done"
        elif i == CURRENT_STAGE_INDEX:
            status = "current"
        else:
            status = "locked"
            
        stages_response.append({
            "name": stage_name,
            "status": status
        })
        
    return jsonify({
        "current_stage": JOURNEY_STAGES[CURRENT_STAGE_INDEX],
        "stages": stages_response,
        "message": MOTIVATIONS[CURRENT_STAGE_INDEX],
        "can_advance": CURRENT_STAGE_INDEX > 0 and CURRENT_STAGE_INDEX < len(JOURNEY_STAGES) - 1
    })


@app.route("/api/journey/advance", methods=["POST"])
def advance_journey():
    """
    POST /api/journey/advance
    Simulates the user completing the current step and advancing to the next.
    """
    global CURRENT_STAGE_INDEX
    
    if CURRENT_STAGE_INDEX > 0 and CURRENT_STAGE_INDEX < len(JOURNEY_STAGES) - 1:
        CURRENT_STAGE_INDEX += 1
        return jsonify({"success": True, "new_stage": JOURNEY_STAGES[CURRENT_STAGE_INDEX]})
        
    return jsonify({"success": False, "error": "Cannot advance from current stage."}), 400


@app.route("/get-steps", methods=["GET"])
def get_steps():
    """
    GET /get-steps
    Returns the full step-by-step voter registration journey.
    """
    data = load_data()

    response = {
        "steps": data["registration_steps"],
        "total_steps": len(data["registration_steps"]),
        "upcoming_elections": data["election_info"]["upcoming_elections"]
    }

    return jsonify(response)


@app.route("/api/election-info", methods=["POST"])
def get_election_info():
    """
    POST /api/election-info
    Body: { "state": "<string>", "district": "<string>" }
    Returns location-based election information if available.
    """
    body = request.get_json()

    if not body or "state" not in body or "district" not in body:
        return jsonify({"error": "Please provide both state and district."}), 400

    q_state = str(body["state"]).strip().lower()
    q_district = str(body["district"]).strip().lower()

    if not q_state or not q_district:
        return jsonify({"error": "State and district cannot be empty."}), 400

    data = load_data()
    loc_data = data.get("location_data", {})

    state_data = loc_data.get(q_state)
    if state_data:
        district_data = state_data.get(q_district)
        if district_data:
            return jsonify(district_data)

    return jsonify({"error": "Data not available for this location"})


@app.route("/api/document-checklist", methods=["POST"])
def document_checklist():
    """
    POST /api/document-checklist
    Body: { "age": <int>, "state": "<string>", "first_time_voter": <boolean> }
    Returns a personalized checklist of required documents based on user input.
    """
    body = request.get_json()

    if not body or "age" not in body:
        return jsonify({"error": "Please provide your age."}), 400

    try:
        age = int(body["age"])
    except (ValueError, TypeError):
        return jsonify({"error": "Age must be a valid number."}), 400

    if age < 18:
        return jsonify({
            "eligibility_status": "not_eligible",
            "message": "You must be 18 years or older to register as a voter",
            "future_steps": [
                "Keep Aadhaar and address documents ready",
                "Check eligibility once you turn 18"
            ]
        })

    # Eligible flow
    state = body.get("state", "").strip()
    first_time_voter = body.get("first_time_voter", False)

    checklist = [
        "Aadhaar Card (Identity Proof)",
        "Address Proof (Electricity Bill / Bank Statement)",
        "Passport Size Photograph",
        "Age Proof (Birth Certificate / 10th Marksheet if needed)"
    ]

    extra_notes = []
    
    if first_time_voter:
        extra_notes.append("First-time voters must ensure name is added in voter list")
        extra_notes.append("Apply using Form 6 on official election portal")
    else:
        extra_notes.append("For making changes or updates to your current voter ID, use Form 8")

    if state:
        extra_notes.append(f"Make sure your address proof is officially registered in {state.title()}")

    return jsonify({
        "eligibility_status": "eligible",
        "checklist": checklist,
        "extra_notes": extra_notes
    })


@app.route("/chat", methods=["POST"])
def chat():
    """
    POST /chat
    Body: { "message": "<user's question>" }
    Returns a rule-based response using keyword matching from election_data.json.
    """
    body = request.get_json()

    if not body or "message" not in body:
        return jsonify({"error": "Please provide a message."}), 400

    user_message = body["message"].strip().lower()

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    data = load_data()
    faqs = data["faqs"]
    fallback = data["fallback_response"]

    # ── Keyword matching ──────────────────────────────────────────────────────
    best_match = None
    best_score = 0

    for faq in faqs:
        score = 0
        for keyword in faq["keywords"]:
            if keyword in user_message:
                # Longer keyword matches = higher relevance
                score += len(keyword.split())
        if score > best_score:
            best_score = score
            best_match = faq

    # ── Greeting detection ────────────────────────────────────────────────────
    greetings = ["hello", "hi", "hey", "good morning", "good evening", "namaste"]
    is_greeting = any(greet in user_message for greet in greetings)

    if is_greeting:
        reply = (
            "Namaste! 🙏 Welcome to the Election Guide Assistant.\n\n"
            "I can help you with:\n"
            "• Minimum voting age\n"
            "• How to register for a Voter ID\n"
            "• Documents required\n"
            "• Finding your polling booth\n"
            "• Election dates\n\n"
            "What would you like to know?"
        )
    elif best_score > 0 and best_match:
        reply = best_match["answer"]
    else:
        reply = fallback

    return jsonify({
        "reply": reply,
        "matched": best_score > 0 or is_greeting
    })


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  Election Guide Assistant — Flask Server")
    print("  Open: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)
