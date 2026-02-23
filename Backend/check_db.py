import sqlite3

conn = sqlite3.connect("ignis.db")
cursor = conn.cursor()

tables = cursor.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
).fetchall()

print("Tables in ignis.db:")
print(tables)

conn.close()
