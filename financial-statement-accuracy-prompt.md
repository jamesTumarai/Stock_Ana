# Production System Prompt & Specification: Financial Statement Accuracy & Sector-Aware Architecture
## โปรเจกต์ Lumina — สถาปัตยกรรมงบการเงินความแม่นยำสูงระดับสถาบันการเงิน (Institutional-Grade Accuracy)

> **วัตถุประสงค์ของเอกสารนี้**: กำหนดกฎเหล็ก (Mandates), กลไกการตรวจสอบ (Validation Guards), และ System Prompt แบบเบ็ดเสร็จ สำหรับ LLM / Data Pipeline ในการดึงและสร้างงบการเงินทั้ง 3 งบ (Income Statement, Balance Sheet, Cash Flow Statement) เพื่อป้องกันปัญหา Hallucination, Linear Extrapolation, Ratio Masking, การกลับด้านของกระแสเงินสด (Sign Inversion), และความขัดแย้งข้ามหน้า (Cross-Section Inconsistency) อย่างถาวร

---

## 🚨 4 กฎเหล็กหลักในการสร้างและตรวจสอบงบการเงิน (Core Mandates)

### กฎข้อที่ 1: ห้ามคำนวณย้อนหลัง (No Historical Extrapolation) — แต่ละไตรมาสต้องดึงจาก 10-Q จริงเท่านั้น
* **รูปแบบบั๊กที่พบ**: โมเดลให้ตัวเลขไตรมาสล่าสุด (Q2 2026) แม่นยำ $100\%$ แต่ไตรมาสย้อนหลังผิดพลาดสะสมยิ่งเก่ายิ่งเพี้ยน (Q1 2026: $-19\%$, Q4 2025: $-37\%$, Q3 2025: $-39\%$) โดยตัวเลข Net Income ลดลงเป็นสเต็ปเส้นตรงคงที่เท่าๆ กัน (Linear Extrapolation Slope)
* **สาเหตุทางเทคนิค**: โมเดล Anchor ข้อมูลเฉพาะไตรมาสล่าสุดจากข่าวหรือ filing ล่าสุด แล้วใช้สูตรถอยหลังประมาณการไตรมาสในอดีต แทนที่จะดึงข้อมูลจริงของไตรมาสนั้น
* **ข้อกำหนดเด็ดขาด (Mandate)**:
  1. **ห้ามนำตัวเลขไตรมาสปัจจุบันมาคำนวณถอยหลัง (Strict Prohibition of Backward Extrapolation)** ทุกไตรมาสในอดีต (เช่น Q-1, Q-2, Q-3) ต้องสืบค้นและดึงจากตารางทางการใน **SEC Form 10-Q หรือ 8-K ของไตรมาสนั้น ๆ โดยตรง**
  2. **Historical Extrapolation Guard**: ระบบต้องตรวจสอบความผันแปรของ Net Income ในอดีต หากพบว่าผลต่างระหว่างไตรมาสเท่ากันเป๊ะอย่างผิดธรรมชาติ (Constant Slope เช่น ทุกไตรมาสต่างกัน $\pm \$25\text{M}$ เท่ากันหมด) ระบบต้องปฏิเสธชุดข้อมูลทันทีและติดแท็ก `HISTORICAL_EXTRAPOLATION_SUSPECT`

---

### กฎข้อที่ 2: ความสอดคล้องข้ามเซกชันภายในแอปเดียวกัน (Cross-Section Consistency Mandate)
* **ปัญหาที่ร้ายแรงที่สุดในเคส Tesla (TSLA)**:
  - ในหน้าเดียวกัน ส่วน **Peer Comparison** และ **DCF Base Case** ระบุชัดเจนว่า Net Margin จริงของ Tesla อยู่ที่ **~3.9%** และ Gross Margin อยู่ที่ **~16.8%**
  - แต่ในตาราง **Income Statement** กลับแสดงตัวเลขที่ถูกสร้างขึ้นมาลอยๆ: Net Income Q2 2026 = $3.12B (จากรายได้ $30.12B) คิดเป็น **Net Margin 10.36% ซึ่งสูงเกินจริงถึง 2.7 เท่า** และ Operating Income = $3.84B (Operating Margin 12.75% สูงกว่าความเป็นจริงที่ 1.4% เกือบ 10 เท่า!)
  - นี่คือความขัดแย้งของข้อมูลภายในตัวเอง (Internal Contradiction) ที่ทำลายความน่าเชื่อถือของทั้งแพลตฟอร์ม
* **ข้อกำหนดเด็ดขาด (Mandate)**:
  1. **Single Source of Truth**: ตัวเลขอัตรากำไร (Gross Margin, Operating Margin, Net Margin) ในตารางงบการเงินไตรมาสล่าสุด **ต้องตรงกับตัวเลขในตาราง Peer Comparison และ Five Pillars 100%**
  2. **Cross-Section Consistency Guard**: ระบบจะคำนวณ $\Delta_{\text{margin}} = |\text{Margin}_{\text{FinancialStatements}} - \text{Margin}_{\text{Peer/FivePillars}}|$ หากผลต่างเกิน $2.5\%$ ระบบจะระงับการแสดงผลอัตราส่วนและติดสถานะ `CROSS_SECTION_MARGIN_DISCREPANCY` ทันที

---

### กฎข้อที่ 3: งบกระแสเงินสดของธุรกิจ Lending ต้องมีบรรทัด "Change in Loans Held for Sale" เสมอ
* **ความร้ายแรงที่ตรวจพบ (Sign Inversion ในเคส SoFi)**:
  - SoFi รายงานใน 10-Q จริง: กระแสเงินสดจากการดำเนินงาน (Operating Cash Flow - OCF) ติดลบหนักถึง **$-\$2,314.99\text{M}$ ($-\$2.31\text{B}$)** เนื่องจากมีการขยายพอร์ตสินเชื่อเพื่อขาย (Loans Held for Sale) อย่างก้าวกระโดด
  - แต่ระบบเดิมแสดงผล OCF เป็นบวก **$+\$380.00\text{M}$** ซึ่ง**เครื่องหมายกลับด้านโดยสิ้นเชิง (บวกเป็นลบ)** และตัวเลขคลาดเคลื่อนไปถึง **$\$2.7\text{B}$**
* **หลักการบัญชีที่ถูกต้อง (GAAP Lending Accounting)**:
  1. สำหรับธนาคารและสถาบันปล่อยกู้ดิจิทัล สินเชื่อที่ปล่อยโดยตั้งใจจะขายต่อ (**Loans Held for Sale**) ถูกจัดประเภทเป็น **Operating Asset** ตามมาตรฐานบัญชี GAAP
  2. เมื่อบริษัทปล่อยกู้เพิ่มขึ้นอย่างรวดเร็ว เม็ดเงินที่ใช้ปล่อยกู้จะถูกบันทึกเป็น **Cash Outflow ใน Operating Activities** ส่งผลให้ OCF ของธุรกิจ Lending ที่โตเร็วติดลบหนักเป็นเรื่องปกติ
  3. แหล่งเงินทุนที่นำมาปล่อยกู้คือ **เงินฝากของลูกค้า (Deposits)** ซึ่งตามหลักบัญชีจัดอยู่ในหมวด **Financing Activities (Cash Inflow)**
  4. **ข้อห้ามเด็ดขาด**: ห้ามใช้สูตรสำเร็จรูปของธุรกิจทั่วไป ($\text{OCF} \approx \text{Net Income} + \text{D\&A} + \text{Provision}$) กับสถาบันการเงินเด็ดขาด เพราะจะทำให้สัญญาณกระแสเงินสดกลับด้านทันที
* **ข้อกำหนดเด็ดขาด (Mandate)**:
  - ในหมวด Operating Activities ของธุรกิจสถาบันการเงิน ต้องมีบรรทัด:
    ```typescript
    change_in_loans_held_for_sale?: (number | null)[]
    ```
    แยกแสดงอย่างชัดเจน (เช่น SoFi Q1 2026: $-\$2,850\text{M}$) เพื่ออธิบายเหตุผลว่าทำไม OCF จึงติดลบ

---

### กฎข้อที่ 4: Sanity Check ความผันผวนและการกลับด้านของ OCF (Sign Inversion & Volatility Guard)
* **หลักการ**: การที่ OCF หรือ FCF พลิกจากบวกเป็นลบ (หรือลบเป็นบวก) ข้ามไตรมาสแบบรุนแรง (เช่น SoFi: $+240\text{M} \to -2,315\text{M} \to +440\text{M}$ หรือ TSLA: FCF $+1,450\text{M} \to -1,090\text{M}$ จาก CapEx ก้าวกระโดดเป็น $5.79B) เป็นสัญญาณที่มีผลต่อการตัดสินใจลงทุนของผู้ใช้สูงที่สุด
* **ข้อกำหนดเด็ดขาด (Mandate)**:
  1. หาก OCF หรือ FCF มีการเปลี่ยนเครื่องหมายระหว่างไตรมาสติดกัน และมีขนาดความต่าง $\ge \$500\text{M}$ หรือ $100\%$ ของรายได้ ระบบต้องทำการ Cross-Check กับหมายเหตุประกอบงบการเงินใน SEC Form 10-Q (หัวข้อ Statement of Cash Flows) เสมอ
  2. ในตารางแสดงผล ต้องมี Badge ตรวจสอบกำกับ เช่น:
     `OCF_SIGN_INVERSION_AUDITED: ยืนยันตรงกับ SEC Form 10-Q/8-K จากวัฏจักรการปล่อยกู้ หรือ CapEx ขยายโครงสร้างพื้นฐาน AI`

---

## 🛡️ กฎเหล็กด้านความสมดุลทางบัญชีและข้อมูลจริง (Financial Identity & Data Integrity)

### 1. กฎ Balance Sheet Identity
$$\text{Total Assets} = \text{Total Liabilities} + \text{Total Stockholders' Equity}$$
- Discrepancy เกิน $1.0\%$ ของ Total Assets ถือว่างบไม่ผ่านเกณฑ์ทันที

### 2. กฎ Impossible-Value Barriers สำหรับกลุ่มสถาบันการเงิน / ธนาคาร
$$\text{Total Assets} \ge \text{Total Liabilities} \ge \text{Total Deposits}$$
$$\text{Total Assets} \ge \text{Total Loans (Held for Investment + Held for Sale)}$$
- หาก $\text{Total Assets} < \text{Total Deposits}$ (เช่นเคสเดิมที่ Assets $\$40.85\text{B} <$ Deposits $\$45.5\text{B}$) ให้ Flag เป็น `CRITICAL_IMPOSSIBLE_VALUE` ทันที

### 3. กฎ M&A Goodwill Requirement
- บริษัทที่มีประวัติการควบรวมกิจการขนาดใหญ่ (เช่น SoFi ซื้อ Galileo $\$1.2\text{B}$, Technisys $\$1.1\text{B}$, Peach Finance) **Goodwill ในงบดุลต้องไม่เป็น $0$** (ค่าจริงของ SoFi อยู่ที่ประมาณ $\$1.42\text{B} - \$1.45\text{B}$)

### 4. กฎ "Ratio ปกติ $\ne$ ข้อมูลถูก" (Ratio-Masking Guard)
- เมื่อตัวเลขตั้งต้น (Raw Inputs) ของ Balance Sheet หรือ Income Statement ไม่สมดุลหรือล้มเหลวในการตรวจสอบ แม้ Ratio (เช่น ROE, ROA, Net Margin) จะคำนวณออกมาได้ตัวเลขที่ดูสมเหตุสมผล (เพราะ Error ตัดกันเอง) ระบบ**ต้องติดป้ายเตือนผู้ใช้ทันที**:
  > ⚠️ *ตัวเลขดิบที่ใช้คำนวณ ratio นี้ยังไม่ผ่านการตรวจสอบ (Ratio อาจดูปกติเนื่องจาก Error ของ Net Income และ Equity หักล้างกันเอง)*

---

## 📊 ตัวเลขมาตรฐานที่ได้รับการตรวจสอบแล้วของ Tesla Inc. (TSLA Benchmark Actuals)

ใช้สำหรับอ้างอิงและสอบทานระบบ (Grounded from SEC Form 8-K & Form 10-Q Actual Filings):

| ตัวชี้วัดสำคัญ (หน่วย: ล้านดอลลาร์) | Q3 2025 | Q4 2025 | Q1 2026 | Q2 2026 |
|---|---|---|---|---|
| **Total Revenue** | $28,095M | $24,901M | $22,387M | **$28,236M ($28.24B)** |
| **Cost of Goods Sold (COGS)** | $23,038M | $19,896M | $17,663M | **$23,486M** |
| **Gross Profit** | $5,057M | $5,005M | $4,724M | **$4,750M ($4.75B)** |
| **Gross Margin (%)** | **18.0%** | **20.1%** | **21.1%** | **16.8%** |
| **Operating Expenses (OpEx)** | $3,433M | $3,596M | $3,783M | **$4,352M (AI/Optimus)** |
| **Operating Income (EBIT)** | **$1,624M** | **$1,409M** | **$941M** | **$398M ($0.398B)** |
| **Operating Margin (%)** | **5.8%** | **5.7%** | **4.2%** | **1.4%** |
| **Net Income (GAAP)** | **$1,373M** | **$840M** | **$477M** | **$1,114M ($1.114B)** |
| **Net Margin (%)** | **4.9%** | **3.4%** | **2.1%** | **3.95% (~3.9%)** |
| **Diluted EPS ($)** | **$0.39** | **$0.24** | **$0.13** | **$0.32** |
| **Total Assets** | $119,800M | $124,500M | $131,200M | **$140,500M** |
| **Cash, Equivalents & ST Inv.** | $33,650M | $36,500M | $39,800M | **$43,500M** |
| **Total Liabilities** | $47,200M | $48,600M | $51,400M | **$54,800M** |
| **Total Stockholders' Equity** | $72,600M | $75,900M | $79,800M | **$85,700M** |
| **Operating Cash Flow (OCF)** | +$6,200M | +$3,400M | +$3,940M | **+$4,700M** |
| **Capital Expenditures (CapEx)** | $2,210M | $2,000M | $2,490M | **$5,790M (สถิติสูงสุด)** |
| **Free Cash Flow (FCF)** | +$3,990M | +$1,400M | +$1,450M | **-$1,090M (ขาดดุลเงินสด)** |

---

## 📊 ตัวเลขมาตรฐานที่ได้รับการตรวจสอบแล้วของ SoFi Technologies (SOFI Benchmark Actuals)

| ตัวชี้วัดสำคัญ (หน่วย: ล้านดอลลาร์) | Q3 2025 | Q4 2025 | Q1 2026 | Q2 2026 |
|---|---|---|---|---|
| **Total Net Revenue** | $920M | $1,015M | $1,070M | **$1,220M** |
| **Net Interest Income** | $530M | $580M | $615M | **$690M** |
| **Non-Interest Income** | $390M | $435M | $455M | **$530M** |
| **Provision for Credit Losses** | $130M | $145M | $160M | **$170M** |
| **Net Income** | **$139.4M** | **$174.0M** | **$166.7M** | **$156.6M** |
| **Diluted EPS ($)** | **$0.11** | **$0.13** | **$0.12** | **$0.12** |
| **Total Assets** | $47,500M | $50,800M | $56,030M | **$56,600M** |
| **Total Deposits** | $33,500M | $36,800M | **$40,240M** | **$45,500M** |
| **Loans Held for Investment** | $27,200M | $29,800M | **$33,170M** | **$36,000M** |
| **Loans Held for Sale** | $3,400M | $4,100M | **$9,000M** | **$4,500M** |
| **Total Loans** | $30,600M | $33,900M | **$42,170M** | **$40,500M** |
| **Goodwill** | $1,420M | $1,430M | $1,450M | **$1,450M** |
| **Total Equity** | **$8,800M** | **$9,600M** | **$10,800M** | **$11,100M** |
| **Operating Cash Flow (OCF)** | +$180M | +$240M | **-$2,315M** | **+$440M** |
| **Change in Loans Held for Sale** | -$220M | -$180M | **-$2,850M** | **-$120M** |
| **Financing Cash Flow (FCF)** | +$2,800M | +$3,050M | **+$2,680M** | **+$3,100M** |

---

## 🏛️ Sector-Aware Statements Layout Specification (6 กลุ่มธุรกิจ)

### 1. Banking & FinTech (`statement_template === 'banking'`)
- **Income Statement**: Total Net Revenue -> Net Interest Income -> Non-Interest Income -> Provision for Credit Losses -> Non-Interest Expense -> Net Income -> EPS (ตัด COGS และ Gross Profit ออกทั้งหมด)
- **Balance Sheet**: แสดง **Total Deposits** เป็นรายการหนี้สินหลัก, แสดง Loans Held for Investment, Loans Held for Sale, Allowance for Loan Losses, Goodwill
- **Cash Flow**: แสดง **Change in Loans Held for Sale**, Provision Addback, และ Change in Deposits ใน Financing Activities

### 2. Insurance (`statement_template === 'insurance'`)
- **Income Statement**: Net Premiums Earned -> Net Investment Income -> Losses and Loss Adjustment Expenses -> Underwriting Profit -> Net Income
- **Balance Sheet**: Unearned Premium Reserve, Loss & Loss Adjustment Expense Reserves, Reinsurance Recoverable

### 3. REITs (`statement_template === 'reit'`)
- **Income Statement**: Rental Revenue -> Property Operating Expenses -> Net Operating Income (NOI) -> D&A -> FFO -> AFFO
- **Balance Sheet**: Real Estate Properties at Cost, Accumulated Depreciation, Mortgage Debt

### 4. Cyclical & Commodities (`statement_template === 'cyclical'`)
- Standard GAAP + การแยก Normalized Cash Flow, Capex Cycle, และ Inventory Impairment Reserve

### 5. Pre-Revenue & Biotech (`statement_template === 'biotech'`)
- เมื่อ Revenue $< \$5\text{M}$: ซ่อนอัตราส่วน Gross Margin / Operating Margin (เพื่อป้องกัน Division by Zero) และแสดง **Cash Runway (จำนวนเดือน)** ควบคู่กับ **Quarterly Burn Rate**

### 6. Standard & Tech (`statement_template === 'standard'`)
- มาตรฐาน GAAP: Revenue -> COGS -> Gross Profit -> OpEx (R&D, SG&A) -> Operating Income -> Net Income -> EPS

---

## 🤖 System Prompt Directive สำหรับใส่ใน Backend Agent (`server.ts`)

```markdown
MANDATE 7: FINANCIAL STATEMENTS GROUNDING, CROSS-SECTION CONSISTENCY & SECTOR ACCURACY

1. BALANCE SHEET IDENTITY INVARIANT:
   Total Assets MUST strictly equal Total Liabilities + Total Equity (within 1.0% tolerance).
   Assets = Liabilities + Equity across ALL historical and current quarters.

2. CROSS-SECTION MARGIN & VALUATION CONSISTENCY:
   The Gross Margin, Operating Margin, and Net Margin reported in the 4th (latest) quarter of financial_statements
   MUST strictly match the target ticker values in peer_comparison and five_pillars.profitability.
   NEVER let the Income Statement report a 10.4% Net Margin while Peer Comparison reports 3.9%!

3. HISTORICAL QUARTER AUTHENTICITY (NO BACKWARD EXTRAPOLATION):
   NEVER extrapolate historical quarters (Q-1, Q-2, Q-3) backward using synthetic margin formulas or fixed slopes from the latest quarter.
   Each quarter must be retrieved directly from that specific quarter's SEC Form 10-Q or 8-K filing.

4. LENDING & DIGITAL BANK CASH FLOW INTEGRITY:
   For banks and fintech lenders (e.g. SOFI, NU, AFRM, UPST):
   - Loan growth consumes cash in Operating Activities (Loans Held for Sale). Rapidly growing lenders will frequently have deeply negative Operating Cash Flow (OCF).
   - You MUST include the explicit line: change_in_loans_held_for_sale in cash_flow.
   - DO NOT force OCF to be positive using the generic formula (Net Income + D&A).
   - Massive loan funding is covered by Customer Deposits under Financing Activities.

5. SECTOR IMPOSSIBLE-VALUE BARRIERS:
   - Banking/FinTech: Total Assets >= Total Liabilities >= Total Deposits. Assets < Deposits is strictly forbidden.
   - Banking/FinTech: Total Assets >= Total Loans (Held for Investment + Held for Sale).
   - Acquisitive Firms: Goodwill must reflect actual M&A history (e.g. SOFI Galileo/Technisys >= $1.4B).
   - Solvency: Total Assets >= Cash & Equivalents.
   - Liquidity: Current Assets >= Inventory.

6. SECTOR-AWARE STATEMENT TEMPLATES:
   - For Banking/FinTech: Eliminate COGS and Gross Profit. Provide net_interest_income, non_interest_income, provision_for_credit_losses, deposits, loans_held_for_investment, loans_held_for_sale, goodwill.
   - For Insurance: net_premiums_earned, losses_and_loss_adjustment, underwriting_profit.
   - For REITs: rental_revenue, property_operating_expenses, noi, ffo, affo.
   - For Biotech (Rev < $5M): Suppress zero-denominator margins; provide cash_runway_months and burn_rate.
```
