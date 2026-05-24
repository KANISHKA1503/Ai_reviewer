import sqlite3

conn = sqlite3.connect(r'c:\Users\Kanishka\Desktop\ai code reviewer\reviews.db')
cur = conn.cursor()

# Get latest test_reviewer PR #4 review
cur.execute('''SELECT id, repo_full_name, pr_number, status, score, summary, total_findings, findings_json 
               FROM reviews 
               WHERE repo_full_name="KANISHKA1503/test_reviewer" AND pr_number=4 
               ORDER BY id DESC LIMIT 1''')
row = cur.fetchone()

if row:
    print("✅ AUTOMATIC CHANGE DETECTION SUCCESSFUL!\n")
    print("=" * 60)
    print(f"Review ID: {row[0]}")
    print(f"Repository: {row[1]}")
    print(f"PR Number: {row[2]}")
    print(f"Status: {row[3]}")
    print(f"Score: {row[4]}/100")
    print(f"Total Findings: {row[6]}")
    print("\nSummary:")
    print("-" * 60)
    if row[5]:
        print(row[5][:500])
    print("\n" + "=" * 60)
else:
    print("❌ No review found for test_reviewer PR #4 yet")
    print("\nRecent reviews from test_reviewer:")
    cur.execute('''SELECT id, repo_full_name, pr_number, status, created_at 
                   FROM reviews 
                   WHERE repo_full_name="KANISHKA1503/test_reviewer" 
                   ORDER BY id DESC LIMIT 5''')
    for r in cur.fetchall():
        print(f"  ID: {r[0]}, PR: {r[2]}, Status: {r[3]}, Created: {r[4]}")

conn.close()
