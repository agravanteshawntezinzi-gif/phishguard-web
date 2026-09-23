import json
import urllib.request
import os
import requests # Added for the PythonAnywhere webhook

PHISHTANK_URL = "http://data.phishtank.com/data/online-valid.json"
OPENPHISH_URL = "https://openphish.com/feed.txt"
OUTPUT_FILE = "phishtank_domains.txt"

# Your PythonAnywhere Gateway
PYTHONANYWHERE_WEBHOOK = "https://shawntezinzi.pythonanywhere.com/update_phishtank_webhook"
API_KEY = "phishguard12345"

def extract_domain(url):
    try:
        domain = url.split('//')[-1].split('/')[0].split(':')[0].lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return ""

valid_domains = set()

print("Downloading latest PhishTank database...")
try:
    # Using your Custom User-Agent so we don't get blocked!
    req = urllib.request.Request(PHISHTANK_URL, headers={'User-Agent': 'phishtank/phishguard-bot-v1.0'})
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    # Extract ONLY valid phishes
    for item in data:
        if item.get("verified") == "yes" and item.get("valid") == "yes":
            dom = extract_domain(item.get("url", ""))
            if dom:
                valid_domains.add(dom)
    print("✅ Extracted PhishTank domains.")
except Exception as e:
    print(f"❌ Error updating PhishTank: {e}")

print("Downloading OpenPhish database (Extra Threat Intel)...")
try:
    op_req = urllib.request.Request(OPENPHISH_URL, headers={'User-Agent': 'phishtank/phishguard-bot-v1.0'})
    with urllib.request.urlopen(op_req) as response:
        lines = response.read().decode().splitlines()
        for line in lines:
            dom = extract_domain(line)
            if dom:
                valid_domains.add(dom)
    print("✅ Extracted OpenPhish domains.")
except Exception as e:
    print(f"❌ Error updating OpenPhish: {e}")

domains_list = sorted(list(valid_domains))

# Save to the tiny, lightweight text file in GitHub
try:
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for d in domains_list:
            f.write(f"{d}\n")
    print(f"✅ Successfully saved {len(domains_list)} valid domains locally!")
except Exception as e:
    print(f"❌ Error saving file: {e}")
    # SAFETY NET: Create blank fallback file
    if not os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write("")

# --- THE MAGIC DOOR TO PYTHONANYWHERE ---
print("Transmitting data to PythonAnywhere server...")
try:
    payload = {"domains": domains_list}
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
    pa_response = requests.post(PYTHONANYWHERE_WEBHOOK, json=payload, headers=headers)
    print(f"PythonAnywhere response: {pa_response.status_code} - {pa_response.text}")
except Exception as e:
    print(f"❌ Webhook error: {e}")
