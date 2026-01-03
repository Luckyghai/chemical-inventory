from flask import Flask, render_template, jsonify, request, redirect, url_for, session, flash
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = 'your_very_secure_secret_key' # Change this in production!

# --- GEMINI CONFIGURATION ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- DATABASE CONFIGURATION ---
db_config = {
    'host': 'localhost',
    'user': os.getenv('USER') or 'luckyghai', # Fallback or env var
    'password': '', # No password for local peer/trust auth common on Mac
    'database': 'lab_inventory_db'
}


def get_db_connection():
    """Establishes connection to PostgreSQL"""
    try:
        conn = psycopg2.connect(**db_config)
        return conn
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

# --- AUTH DECORATOR ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please login to access this page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- AUTH ROUTES ---

@app.route('/')
def landing():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return redirect(url_for('signup'))

        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            flash('Username already exists!', 'danger')
            cursor.close()
            conn.close()
            return redirect(url_for('signup'))

        # Create user
        hashed_pw = generate_password_hash(password)
        try:
            cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, hashed_pw))
            conn.commit()
            flash('Account created! Please login.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash(f'Error creating account: {e}', 'danger')
        finally:
            cursor.close()
            conn.close()

    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            flash('Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password', 'danger')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully.', 'info')
    return redirect(url_for('landing'))

# --- APP ROUTES ---

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('home.html')

@app.route('/chemicals')
@login_required
def chemicals():
    return render_template('chemicals.html')

@app.route('/equipment')
@login_required
def equipment():
    return render_template('equipment.html')

@app.route('/equipment/form')
@login_required
def item_form():
    return render_template('equipment_form.html')

@app.route('/form.html')
@login_required
def form():
    return render_template('form.html')

@app.route('/orders')
@login_required
def orders():
    return render_template('orders.html')

@app.route('/resource-management')
@login_required
def resource_management():
    return render_template('resource_management.html')

# --- API ENDPOINTS (The "Bridge") ---
# IMPORTANT: Ideally, APIs should also be protected or token-based. 
# For now, we'll leave them open or protect them with session check if called from frontend.
# Adding @login_required to APIs used by frontend JS ensures security.

# --- CHEMICALS API ---

# 1. Get All Chemicals
@app.route('/api/chemicals', methods=['GET'])
@login_required
def get_chemicals():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
        SELECT c.*, l.name as location_name 
        FROM chemicals c 
        LEFT JOIN locations l ON c.location_id = l.id
        ORDER BY c.created_at DESC
    """
    cursor.execute(query)
    chemicals = cursor.fetchall()
    
    cursor.close()
    conn.close()
    return jsonify(chemicals)

# 2. Get Single Chemical
@app.route('/api/chemicals/<int:id>', methods=['GET'])
@login_required
def get_chemical(id):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM chemicals WHERE id = %s", (id,))
    chemical = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if chemical:
        return jsonify(chemical)
    return jsonify({'error': 'Chemical not found'}), 404

# 3. Add or Update Chemical
@app.route('/api/chemicals', methods=['POST'])
@login_required
def save_chemical():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    expiry = data.get('expiry_date')
    if not expiry or expiry == '':
        expiry = None
    
    loc_id = data.get('location_id')
    if not loc_id or loc_id == '':
        loc_id = None

    try:
        if data.get('id'):
            query = """
                UPDATE chemicals 
                SET name=%s, cas_number=%s, quantity=%s, unit=%s, 
                    location_id=%s, expiry_date=%s, safety_notes=%s 
                WHERE id=%s
            """
            vals = (data['name'], data['cas_number'], data['quantity'], data['unit'], 
                    loc_id, expiry, data['safety_notes'], data['id'])
            cursor.execute(query, vals)
        else:
            query = """
                INSERT INTO chemicals (name, cas_number, quantity, unit, location_id, expiry_date, safety_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            vals = (data['name'], data['cas_number'], data['quantity'], data['unit'], 
                    loc_id, expiry, data['safety_notes'])
            cursor.execute(query, vals)

        conn.commit()
        return jsonify({'message': 'Success'}), 201

    except Exception as e:
        print(f"ERROR SAVING CHEMICAL: {e}")
        return jsonify({'error': str(e)}), 500
    
    finally:
        cursor.close()
        conn.close()

# 4. Delete Chemical
@app.route('/api/chemicals/<int:id>', methods=['DELETE'])
@login_required
def delete_chemical(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chemicals WHERE id = %s", (id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Deleted successfully'})

# --- EQUIPMENT API ---

# 1. Get All Equipments
@app.route('/api/equipments', methods=['GET'])
@login_required
def get_equipments():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT e.*, l.name as location_name 
        FROM equipments e 
        LEFT JOIN locations l ON e.location_id = l.id
        ORDER BY e.created_at DESC
    """
    cursor.execute(query)
    equipments = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(equipments)

# 2. Get Single Equipment
@app.route('/api/equipments/<int:id>', methods=['GET'])
@login_required
def get_equipment_by_id(id):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM equipments WHERE id = %s", (id,))
    equip = cursor.fetchone()
    cursor.close()
    conn.close()
    if equip:
        return jsonify(equip)
    return jsonify({'error': 'Equipment not found'}), 404

# 3. Add or Update Equipment
@app.route('/api/equipments', methods=['POST'])
@login_required
def save_equipment():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Dates
    p_date = data.get('purchase_date') or None
    lm_date = data.get('last_maintenance_date') or None
    nm_date = data.get('next_maintenance_date') or None
    loc_id = data.get('location_id') or None

    try:
        if data.get('id'):
            # UPDATE
            query = """
                UPDATE equipments 
                SET name=%s, model_number=%s, serial_number=%s, manufacturer=%s, 
                    quantity=%s, location_id=%s, purchase_date=%s, 
                    last_maintenance_date=%s, next_maintenance_date=%s, 
                    status=%s, description=%s 
                WHERE id=%s
            """
            vals = (data['name'], data['model_number'], data['serial_number'], data['manufacturer'],
                    data['quantity'], loc_id, p_date, lm_date, nm_date, 
                    data['status'], data['description'], data['id'])
            cursor.execute(query, vals)
        else:
            # INSERT
            query = """
                INSERT INTO equipments (name, model_number, serial_number, manufacturer, 
                                     quantity, location_id, purchase_date, 
                                     last_maintenance_date, next_maintenance_date, 
                                     status, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            vals = (data['name'], data['model_number'], data['serial_number'], data['manufacturer'],
                    data['quantity'], loc_id, p_date, lm_date, nm_date, 
                    data['status'], data['description'])
            cursor.execute(query, vals)

        conn.commit()
        return jsonify({'message': 'Success'}), 201
    except Exception as e:
        print(f"ERROR SAVING EQUIPMENT: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# 4. Delete Equipment
@app.route('/api/equipments/<int:id>', methods=['DELETE'])
@login_required
def delete_equipment(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM equipments WHERE id = %s", (id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Deleted successfully'})

# --- COMMON API ---

@app.route('/api/locations', methods=['GET'])
@login_required
def get_locations():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM locations")
    locations = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(locations)

# --- BOOKINGS API ---

# 1. Get All Bookings
@app.route('/api/bookings', methods=['GET'])
@login_required
def get_bookings():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM bookings ORDER BY booking_date DESC")
    bookings = cursor.fetchall()
    
    # Format date for JSON
    for b in bookings:
        if b['booking_date']:
            b['booking_date'] = b['booking_date'].isoformat()
            
    cursor.close()
    conn.close()
    return jsonify(bookings)

# 2. Add New Booking
@app.route('/api/bookings', methods=['POST'])
@login_required
def save_booking():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            INSERT INTO bookings (type, resource_name, researcher_name, booking_date)
            VALUES (%s, %s, %s, %s) RETURNING id
        """
        vals = (data['type'], data['resourceName'], data['researcherName'], data['date'])
        cursor.execute(query, vals)
        new_id = cursor.fetchone()[0] # Get ID from RETURNING
        conn.commit()
        return jsonify({'message': 'Success', 'id': new_id}), 201
    except Exception as e:
        print(f"ERROR SAVING BOOKING: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# 3. Delete Booking
@app.route('/api/bookings/<int:id>', methods=['DELETE'])
@login_required
def delete_booking_api(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bookings WHERE id = %s", (id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Deleted successfully'})

# --- PURCHASE ORDERS API ---

# 1. Get All Orders
@app.route('/api/orders', methods=['GET'])
@login_required
def get_orders():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM purchase_orders ORDER BY order_date DESC")
        orders = cursor.fetchall()
        # Format date
        for o in orders:
            if o['order_date']:
                o['order_date'] = o['order_date'].isoformat()
        return jsonify(orders)
    except Exception as e:
        print(f"Error fetching orders: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# 2. Create Order
@app.route('/api/orders', methods=['POST'])
@login_required
def create_order():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Basic validation
        if not all(k in data for k in ('po_number', 'supplier', 'items')):
            return jsonify({'error': 'Missing required fields'}), 400

        query = """
            INSERT INTO purchase_orders (po_number, supplier, order_date, items, total_cost, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        vals = (
            data['po_number'],
            data['supplier'],
            data.get('order_date') or None, # Default to today if None handled by DB? No, DB says NOT NULL. Frontend should send it.
            data['items'],
            data.get('total_cost', 0),
            data.get('status', 'Pending')
        )
        cursor.execute(query, vals)
        new_id = cursor.fetchone()[0]
        conn.commit()
        return jsonify({'message': 'Order created', 'id': new_id}), 201
    except Exception as e:
        print(f"Error creating order: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# 3. Update Order
@app.route('/api/orders/<int:id>', methods=['PUT'])
@login_required
def update_order(id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # We can update any field provided, but mostly Status is key
        fields = []
        vals = []
        
        if 'po_number' in data:
            fields.append("po_number = %s")
            vals.append(data['po_number'])
        if 'supplier' in data:
            fields.append("supplier = %s")
            vals.append(data['supplier'])
        if 'order_date' in data:
            fields.append("order_date = %s")
            vals.append(data['order_date'])
        if 'items' in data:
            fields.append("items = %s")
            vals.append(data['items'])
        if 'total_cost' in data:
            fields.append("total_cost = %s")
            vals.append(data['total_cost'])
        if 'status' in data:
            fields.append("status = %s")
            vals.append(data['status'])
            
        if not fields:
            return jsonify({'error': 'No fields to update'}), 400
            
        vals.append(id)
        query = f"UPDATE purchase_orders SET {', '.join(fields)} WHERE id = %s"
        cursor.execute(query, tuple(vals))
        conn.commit()
        return jsonify({'message': 'Order updated successfully'})
    except Exception as e:
        print(f"Update Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# 4. Delete Order
@app.route('/api/orders/<int:id>', methods=['DELETE'])
@login_required
def delete_order(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM purchase_orders WHERE id = %s", (id,))
        conn.commit()
        return jsonify({'message': 'Deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# --- AI LOOKUP API ---

@app.route('/api/ai-lookup', methods=['POST'])
@login_required
def ai_lookup():
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API Key not configured. Please set GEMINI_API_KEY env var.'}), 503
    
    data = request.json
    query = data.get('query')
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"""
        You are a lab assistant. Provide technical details for the chemical '{query}'.
        Return ONLY valid JSON with no markdown formatting.
        Keys:
        - cas_number (string)
        - safety_notes (short summary of hazards, max 15 words)
        - recommended_storage (suggest a storage type like 'Flammables Cabinet', 'General', 'Fridge', etc.)
        - expiry_months (integer estimate of shelf life in months, default 24 if unknown)
        
        Example: {{"cas_number": "67-64-1", "safety_notes": "Highly flammable. Causes eye irritation.", "recommended_storage": "Flammables Cabinet", "expiry_months": 60}}
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up code blocks if present
        if text.startswith('```json'):
            text = text[7:-3]
        elif text.startswith('```'):
            text = text[3:-3]
            
        result = json.loads(text)
        return jsonify(result)
        
    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({'error': f"AI processing failed: {str(e)}"}), 500

@app.route('/api/check-hazards', methods=['GET'])
@login_required
def check_hazards():
    """
    Analyzes inventory for dangerous combinations within the same storage location.
    """
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API Key not configured.'}), 503

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Fetch chemicals with location names
        query = """
            SELECT c.name as chemical, l.name as location 
            FROM chemicals c
            JOIN locations l ON c.location_id = l.id
            ORDER BY l.name
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # 2. Group by Location
        inventory_map = {}
        for row in rows:
            loc = row[1] # location name
            chem = row[0] # chemical name
            if loc not in inventory_map:
                inventory_map[loc] = []
            inventory_map[loc].append(chem)

        # 3. Filter interesting locations (more than 1 chemical)
        locations_to_check = {k: v for k, v in inventory_map.items() if len(v) > 1}
        
        if not locations_to_check:
            return jsonify({'analysis': 'No shared storage locations found with multiple chemicals. Inventory looks safe!', 'safe': True})

        # 4. Construct Prompt
        inventory_str = json.dumps(locations_to_check, indent=2)
        
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"""
        You are a Chemical Safety Officer. Analyze this inventory for dangerous incompatible storage.
        The input is a JSON object where keys are "Location Names" and values are lists of chemicals stored there.
        
        Inventory:
        {inventory_str}

        Task:
        Identify ANY incompatible pairs stored in the SAME location (e.g., Acids + Bases, Oxidizers + Flammables).
        
        Return ONLY valid JSON:
        {{
            "hazards": [
                {{
                    "location": "Location Name",
                    "chemicals": ["Chemical A", "Chemical B"],
                    "risk": "Explanation of the reaction/danger (e.g. Generation of toxic gas)",
                    "severity": "High" (or Medium/Low)
                }}
            ],
            "safe": boolean (true if no hazards found)
        }}
        """

        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up code blocks
        if text.startswith('```json'):
            text = text[7:-3]
        elif text.startswith('```'):
            text = text[3:-3]
            
        print(f"AI Hazard Response: {text}") # Debug log
        result = json.loads(text)
        return jsonify(result)

    except Exception as e:
        print(f"Hazard Scan Error: {e}")
        return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Hazard Scan Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai-search', methods=['POST'])
@login_required
def ai_search():
    """
    Semantic search: Sends user query + inventory summary to Gemini to find matches.
    """
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API Key not configured.'}), 503

    data = request.json
    user_query = data.get('query')
    if not user_query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        # 1. Fetch all chemicals (ID, Name, CAS, Description/Safety)
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id, name, cas_number, safety_notes FROM chemicals")
        inventory = cursor.fetchall()
        cursor.close()
        conn.close()

        if not inventory:
            return jsonify({'matches': [], 'reason': 'Inventory is empty.'})

        # 2. Prepare context for AI (Lightweight payload)
        inventory_list = [
            f"ID: {item['id']}, Name: {item['name']}, CAS: {item['cas_number']}, Notes: {item['safety_notes']}"
            for item in inventory
        ]
        inventory_context = "\n".join(inventory_list)

        # 3. Prompt Gemini
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"""
        You are an intelligent lab inventory assistant.
        User Query: "{user_query}"

        Below is the current chemical inventory:
        ---
        {inventory_context}
        ---

        Task: Select the chemicals that best match the user's intent.
        - If the user asks for "flammables", find chemicals with "flammable" in notes/name.
        - If they ask "something to clean glass", find solvents like Acetone.
        - Be smart about synonyms.

        Return ONLY a JSON object:
        {{
            "match_ids": [list of integer IDs],
            "explanation": "Brief reason for selection (max 10 words)"
        }}
        """

        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up
        if text.startswith('```json'): code_block = text[7:-3]
        elif text.startswith('```'): code_block = text[3:-3]
        else: code_block = text

        result = json.loads(code_block)
        return jsonify(result)

    except Exception as e:
        print(f"AI Search Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
