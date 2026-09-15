import json
import urllib.request

PHISHTANK_URL = "http://data.phishtank.com/data/online-valid.json"
OUTPUT_FILE = "phishtank_domains.txt"

def extract_domain(url):
    try:
        domain = url.split('//')[-1].split('/')[0].split(':')[0].lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return ""

print("Downloading latest PhishTank database...")
try:
    # Download the JSON file
    req = urllib.request.Request(PHISHTANK_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    # Extract ONLY valid phishes
    valid_domains = set()
    for item in data:
        # Check the exact tags you noticed!
        if item.get("verified") == "yes" and item.get("valid") == "yes":
            dom = extract_domain(item.get("url", ""))
            if dom:
                valid_domains.add(dom)
                
    # Save to a tiny, lightweight text file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for d in sorted(valid_domains):
            f.write(f"{d}\n")
            
    print(f"Successfully extracted {len(valid_domains)} valid domains!")
    
except Exception as e:
    print(f"Error updating PhishTank: {e}")
