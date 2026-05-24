import sqlite3

conn = sqlite3.connect('reviews.db')
cur = conn.cursor()

# Get recent reviews for PR #1
cur.execute('SELECT id, repo_full_name, pr_number, status, score, summary, error_message FROM reviews WHERE repo_full_name="KANISHKA1503/Ai_reviewer" AND pr_number=1 ORDER BY id DESC LIMIT 3')
rows = cur.fetchall()
print("Latest Reviews for PR #1:")
print("=========================")
for r in rows:
    print(f"\nID: {r[0]}")
    print(f"Status: {r[3]}")
    print(f"Score: {r[4]}")
    if r[5]:
        print(f"Summary: {r[5][:200]}...")
    if r[6]:
        print(f"Error: {r[6]}")
    else:
        print("Error: None")

conn.close()
