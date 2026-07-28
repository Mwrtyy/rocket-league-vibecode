from pathlib import Path

client_path = Path("apps/client/src/main.ts")
client = client_path.read_text()
needle = "  ARENA,\n"
if client.count(needle) != 1:
    raise RuntimeError(f"expected one unused ARENA import, found {client.count(needle)}")
client_path.write_text(client.replace(needle, "", 1))
Path(__file__).unlink()
