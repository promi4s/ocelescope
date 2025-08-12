import sqlite3
from pathlib import Path
from typing import Optional

import pandas as pd
from pandas import DataFrame


def get_table_names_from_sqlite(path: Path):
    # Connect to your SQLite database
    conn = sqlite3.connect(path)

    # Create a cursor object to execute SQL queries
    cursor = conn.cursor()

    # Query the sqlite_master table to get table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")

    # Fetch all table names as a list
    table_names = cursor.fetchall()

    # Close the cursor and the connection
    cursor.close()
    conn.close()

    table_names = [table[0] for table in table_names]

    return table_names


def get_table_from_sqlite(path: Path, table_name: str) -> Optional[DataFrame]:
    if table_name not in get_table_names_from_sqlite(path):
        return None

    # Connect to the SQLite database
    conn = sqlite3.connect(path)

    # Define your SQL query
    sql_query = f"SELECT * FROM {table_name}"

    # Use pandas.read_sql_query() to fetch the data into a DataFrame
    df = pd.read_sql_query(sql_query, conn)

    # Close the database connection
    conn.close()

    if "index" in df.columns:
        df = df.set_index("index")
    elif table_name == "quantity_operations":
        pass
    elif "ocel_id" in df.columns:
        if "object" in table_name:
            if table_name == "object":
                df = df.set_index("ocel_id")
            else:
                pass
        else:
            df = df.set_index("ocel_id")
    else:
        pass

    return df
