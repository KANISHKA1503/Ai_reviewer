import sqlite3

conn = sqlite3.connect('reviews.db')
cur = conn.cursor()

# Get schema
cur.execute("PRAGMA table_info(reviews)")
cols = cur.fetchall()
print("Reviews Table Schema:")
print("======================")
for c in cols:
    print(f"  {c[1]} ({c[2]})")

# Get recent reviews
print("\nRecent Reviews:")
print("===============")
cur.execute("SELECT id, repo_full_name, pr_number, status FROM reviews ORDER BY id DESC LIMIT 5")
rows = cur.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Repo: {r[1]}, PR: {r[2]}, Status: {r[3]}")

if not rows:
    print("No reviews found in database")

conn.close()
