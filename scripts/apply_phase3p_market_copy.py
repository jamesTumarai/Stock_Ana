from pathlib import Path

path = Path('src/ReportTemplate.tsx')
text = path.read_text()
replacements = {
    "setRefreshSuccessMessage(isThai ? 'อัปเดตราคาตลาดสดสำเร็จ!' : 'Live market data updated!');": "setRefreshSuccessMessage(isThai ? 'อัปเดต Market Snapshot สำเร็จ!' : 'Market snapshot updated!');",
    "// Auto-sync live market data from Yahoo Finance on report mount": "// Reset provider market snapshot overrides when the report ticker changes",
    "title={isThai ? 'ดึงราคาหุ้นและข้อมูลตลาดสดล่าสุดจาก Yahoo Finance' : 'Refresh live market prices & market caps from Yahoo Finance'}": "title={isThai ? 'ดึง Market Snapshot ล่าสุดจาก Yahoo Finance (อาจล่าช้าตามผู้ให้บริการ)' : 'Refresh the latest Yahoo Finance market snapshot; provider data may be delayed'}",
    ": (isThai ? 'อัปเดตราคาตลาดสด' : 'Live Refresh')": ": (isThai ? 'อัปเดต Market Snapshot' : 'Refresh Snapshot')",
}
for old, new in replacements.items():
    if old not in text and new not in text:
        raise SystemExit(f'ReportTemplate market copy anchor missing: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)

path = Path('src/components/PeerComparisonTable.tsx')
text = path.read_text()
replacements = {
    "title={isThai ? 'ดึงราคาหุ้นและข้อมูลสดล่าสุดจาก Yahoo Finance' : 'Refresh live prices and market caps from Yahoo Finance'}": "title={isThai ? 'ดึง Market Snapshot ล่าสุดจาก Yahoo Finance (อาจล่าช้าตามผู้ให้บริการ)' : 'Refresh the latest Yahoo Finance market snapshot; provider data may be delayed'}",
    "{isRefreshing ? (isThai ? 'กำลังดึง...' : 'Syncing...') : (isThai ? '⚡ อัปเดตสด' : '⚡ Live Sync')}": "{isRefreshing ? (isThai ? 'กำลังดึง...' : 'Refreshing...') : (isThai ? '↻ อัปเดต Snapshot' : '↻ Refresh Snapshot')}",
}
for old, new in replacements.items():
    if old not in text and new not in text:
        raise SystemExit(f'PeerComparison market copy anchor missing: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)
