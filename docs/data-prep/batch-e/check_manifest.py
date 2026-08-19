import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('docs/data-prep/batch-e/batch-e-import-manifest.json', 'r', encoding='utf-8') as f:
    m = json.load(f)
print('Manifest version:', m.get('manifest_version'))
print('Generated:', m.get('generated_at'))
for entity, data in m.get('entities', {}).items():
    total = data.get('total_rows', 0)
    nr = data.get('new_ready', 0)
    bl = data.get('blocked', 0)
    print('  ' + entity + ': total=' + str(total) + ' new_ready=' + str(nr) + ' blocked=' + str(bl))
print('Total records:', sum(d.get('total_rows', 0) for d in m.get('entities', {}).values()))
