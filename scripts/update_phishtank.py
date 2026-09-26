import json
import urllib.request
import os
import requests

PHISHTANK_URL = "http://data.phishtank.com/data/online-valid.json"
OPENPHISH_URL = "https://openphish.com/feed.txt"
OUTPUT_FILE = "phishtank_domains.txt"

# Your PythonAnywhere Gateway
PYTHONANYWHERE_WEBHOOK = "https://shawntezinzi.pythonanywhere.com/update_phishtank_webhook"
API_KEY = "phishguard12345"

def extract_domain(url):
    try:
        # Clean and extract just the domain part safely
        domain = url.split('//')[-1].split('/')[0].split(':')[0].lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain.strip()
    except:
        return ""

def main():
    valid_domains = set()

    # ========================================================
    # 1. LOAD PREVIOUS DOMAINS (THE STOCKPILE FEATURE)
    # ========================================================
    print(f"Loading existing domains from {OUTPUT_FILE} to stockpile...")
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    dom = line.strip()
                    if dom:
                        valid_domains.add(dom)
            print(f"✅ Loaded {len(valid_domains)} existing domains into memory.")
        except Exception as e:
            print(f"⚠️ Warning: Could not load existing file. Starting fresh. ({e})")
    else:
        print("No existing file found. Starting fresh stockpile.")

    starting_count = len(valid_domains)

    # ========================================================
    # 2. FETCH LATEST PHISHTANK (UNLIMITED)
    # ========================================================
    print("Downloading latest PhishTank database...")
    try:
        req = urllib.request.Request(PHISHTANK_URL, headers={'User-Agent': 'phishtank/phishguard-bot-v2.0'})
        # Timeout added to prevent infinite hanging
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        phish_count = 0
        for item in data:
            # STRICT CHECK: Must be verified by the community and valid
            if item.get("verified") == "yes" and item.get("valid") == "yes":
                dom = extract_domain(item.get("url", ""))
                if dom:
                    valid_domains.add(dom)
                    phish_count += 1
        print(f"✅ Fetched {phish_count} verified active domains from PhishTank.")
    except Exception as e:
        print(f"❌ Error updating PhishTank: {e}")

    # ========================================================
    # 3. FETCH LATEST OPENPHISH (MAX 500 ON FREE TIER)
    # ========================================================
    print("Downloading OpenPhish database (Extra Threat Intel)...")
    try:
        op_req = urllib.request.Request(OPENPHISH_URL, headers={'User-Agent': 'phishtank/phishguard-bot-v2.0'})
        with urllib.request.urlopen(op_req, timeout=30) as response:
            lines = response.read().decode().splitlines()
            op_count = 0
            for line in lines:
                dom = extract_domain(line)
                if dom:
                    valid_domains.add(dom)
                    op_count += 1
        print(f"✅ Fetched {op_count} domains from OpenPhish.")
    except Exception as e:
        print(f"❌ Error updating OpenPhish: {e}")

    # ========================================================
    # 4. CALCULATE NEW ADDITIONS AND SAVE STOCKPILE
    # ========================================================
    final_count = len(valid_domains)
    new_additions = final_count - starting_count
    print(f"📈 Added {new_additions} brand new unique domains to the stockpile!")

    domains_list = sorted(list(valid_domains))
    print("Saving updated stockpile to file...")
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            for d in domains_list:
                f.write(f"{d}\n")
        print(f"✅ Successfully saved {final_count} total domains locally!")
    except Exception as e:
        print(f"❌ Error saving file: {e}")

    # ========================================================
    # 5. SEND TO PYTHONANYWHERE
    # ========================================================
    print("Transmitting stockpile to PythonAnywhere server...")
    try:
        payload = {"domains": domains_list}
        headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
        # 60 second timeout because a huge list takes a moment to upload
        pa_response = requests.post(PYTHONANYWHERE_WEBHOOK, json=payload, headers=headers, timeout=60)
        print(f"PythonAnywhere response: {pa_response.status_code} - {pa_response.text}")
    except Exception as e:
        print(f"❌ Webhook error: {e}")

if __name__ == "__main__":
    main()
