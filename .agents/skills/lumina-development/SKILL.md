---
name: lumina-development
description: Develop, debug, and verify the Stock_Ana / COIN KING Lumina stock research app. Use when working in this repository on React UI, motion backgrounds, Express APIs, Gemini streaming, financial reports, or Firebase login and history. Do not use for standalone investment research or unrelated projects.
---

# Lumina Development

ใช้ skill นี้เพื่อเปลี่ยนคำขอเกี่ยวกับแอป Lumina ให้เป็นการแก้โค้ดที่ตรวจสอบได้ สื่อสารเป็นภาษาไทยตามบริบทของผู้ใช้ อ่าน `AGENTS.md` ที่ราก repository ก่อนเริ่ม; ไฟล์นั้นกำหนดกติกาโปรเจกต์ ส่วน skill นี้กำหนดขั้นตอนทำงาน

## 1. ระบุผลลัพธ์และขอบเขต

1. หา repository root จากบริบทปัจจุบัน ไม่ hardcode path ของเครื่องเจ้าของโปรเจกต์
2. ตรวจ `git status --short` และ diff เพื่อแยกงานเดิมออกจากสิ่งที่จะเปลี่ยน
3. สรุปพฤติกรรมที่ผู้ใช้ต้องการหนึ่งประโยค เช่น “เลือกหุ้นแล้วเห็นข้อความชัดเจนเมื่อ server ยังไม่มี API key”
4. เลือก flow ด้านล่างตามงาน อ่านเฉพาะไฟล์ที่เกี่ยวข้อง ใช้ implementation จริงเป็นหลักเมื่อเอกสารไม่ตรง
5. หากข้อมูลพอให้ทำได้ ให้ลงมือในขอบเขตนั้น ไม่ถามยืนยันซ้ำ ไม่ขยายงานปรับ UI เป็นการออกแบบใหม่ทั้งแอป

## 2. เลือก flow

### หน้าแรกและพื้นหลัง motion

- เริ่มที่ `src/LandingView.tsx`, `src/components/CrossfadeVideo.tsx`, `src/components/MotionIntro.tsx`, `src/index.css` และจุดเรียกใน `src/App.tsx`
- เปิดหน้าเดิมใน browser และบันทึกสภาพเริ่มต้นก่อนแก้ ระบุปัญหาจริง เช่น ข้อความอ่านยาก ภาพกระตุก หรือ mobile overflow
- รักษาแบรนด์และองค์ประกอบเดิม ปรับเฉพาะขอบเขตที่ขอ การเปลี่ยนวิดีโอเป็นเอฟเฟกต์รูปแบบอื่นถือเป็นการเปลี่ยนทิศทางดีไซน์ ไม่ทำเองเมื่อผู้ใช้เพียงขอให้ลื่นขึ้น
- ใช้ transform/opacity สำหรับ motion เมื่อเหมาะสม หลีกเลี่ยง state update ทุกเฟรม ล้าง timeout, requestAnimationFrame และ listener เมื่อ unmount
- ตรวจ reduced motion, autoplay failure และการอ่านเนื้อหาได้แม้ media ไม่โหลด
- ตรวจ desktop และ mobile รวมทั้ง keyboard focus, ticker selection, analysis mode, language switch และการเลื่อนถึงส่วนท้าย

### การวิเคราะห์หุ้นและ streaming

- ไล่จาก `src/App.tsx` → `/api/analyze` ใน `server.ts` → `server/lib/agentClient.ts` → event parsing → timeline/report
- ตรวจ payload, HTTP status และ response content type ก่อนสรุปว่า streaming เสีย แยก missing configuration, provider error, parsing error และ UI error
- ตรวจการจัดการ chunk ที่ยังไม่ครบ event, error event, abort และการจบ stream โดยไม่ทิ้งสถานะกำลังโหลด
- ตรวจ `GEMINI_API_KEY` ด้วยสถานะว่ามีหรือไม่มีเท่านั้น ไม่แสดงค่า ไม่ฝัง key ลง frontend และไม่เปลี่ยน model/agent identifier ด้วยการเดา
- ใช้ mock stream หรือ fixture สำหรับการทดสอบ logic เมื่อไม่จำเป็นต้องเรียก provider จริง รายงานข้อจำกัดเมื่อทดสอบจริงไม่ได้

### รายงานและการคำนวณ

- ไล่จาก prompt/schema ใน `server.ts` และไฟล์ runtime ใน `agent/` → `server/lib/jsonExtractor.ts` → `src/types.ts` → `src/ReportTemplate.tsx` และ components ที่เกี่ยวข้อง
- เมื่อเปลี่ยน field ให้ตรวจ producer และ consumer ด้วยกัน รักษาการอ่านรายงานเก่าหรือระบุ migration ที่จำเป็น
- ตรวจ currency, fiscal period, units, per-share values, missing values และ denominator เป็นศูนย์ก่อนแก้สูตร
- ใช้ fixture ที่ระบุว่าเป็นข้อมูลทดสอบ ไม่แสดงตัวเลขจำลองเป็นข้อมูลตลาดจริง ไม่เติมข้อมูลขาดด้วยตัวเลขที่แต่งขึ้น
- ตรวจทั้งหน้าจอและ print layout หากแก้ report styling

### Firebase login และ history

- อ่าน Firebase initialization ใน `src/lib/` และ auth/history handlers ใน `src/App.tsx`
- แยกปัญหา popup, authorized domain, permission และ query จากข้อความ error จริง
- รักษาการกรองรายงานตามเจ้าของ ตรวจ authorization ใน rules เมื่อเปลี่ยนการเข้าถึงข้อมูล ไม่แก้ rules ให้ public เพื่อให้ทดสอบผ่าน
- ตรวจ loading/error/empty state และ cleanup ของ auth listener โดยไม่ลบหรือเขียนข้อมูลจริงที่ไม่เกี่ยวข้อง

### Upload, download และ logs

- ตรวจ routes ใน `server.ts` ที่รับ filename, ticker หรือ path ก่อนทำ filesystem operation
- ตรวจชนิด input, directory containment, content/body format และข้อจำกัดขนาดไฟล์
- ใช้ temporary fixtures สำหรับ regression check; ทดสอบชื่อไฟล์ไม่ถูกต้องโดยต้องถูกปฏิเสธก่อนเขียนไฟล์
- ตรวจว่า static routes ไม่เปิดเผย repository หรือข้อมูลลับ ไม่ถือว่า status 200 แปลว่าได้ไฟล์ที่ต้องการ เพราะ Vite SPA fallback อาจคืน HTML

## 3. แก้และตรวจสอบ

1. แก้ให้น้อยที่สุดที่ทำให้พฤติกรรมเป้าหมายถูกต้อง แยก defect ที่พบเพิ่มเติมจากงานหลัก ไม่แทรก refactor ที่ไม่เกี่ยวข้อง
2. ใช้ npm ตาม lockfile ปัจจุบัน อ่าน scripts ใน `package.json` ก่อนรัน ไม่เพิ่ม dependency หากเครื่องมือเดิมทำงานได้
3. หลังแก้ TypeScript/React/API ให้รัน `npm run lint` และ `npm run build` ตามขอบเขต บันทึก failure และ warning ตามจริง
4. ใช้ `npm run dev` สำหรับ full app เพราะมี Express API ร่วมกับ Vite; ตรวจ port ที่ว่างก่อนเริ่ม ไม่หยุด process อื่นเพื่อแย่งพอร์ต
5. หากปิด HMR ต้อง reload หน้าเว็บ และหลังแก้ server ต้อง restart process ของโปรเจกต์ ตรวจ environment เดิมก่อน restart
6. เปิด browser ตรวจหน้าจอจริงและ console แล้วทดสอบ flow ที่แก้ทั้ง success/error ตามที่ credentials อนุญาต
7. เพิ่ม regression test เฉพาะ logic ที่มีนัยสำคัญ โดยใช้ test tooling ที่มีอยู่ก่อน ไม่เพิ่ม framework เพื่อทดสอบการเปลี่ยนข้อความหรือ spacing
8. ตรวจ `git diff --check` และ diff สุดท้าย ไม่รวม build output, credentials หรือ artifacts ในงานส่ง

งานเอกสารอย่างเดียวให้ตรวจชื่อไฟล์, frontmatter, paths และ diff โดยไม่ต้อง build แอป

## 4. ส่งมอบ

สรุปเป็นภาษาไทยอย่างกระชับ:

- พฤติกรรมที่เปลี่ยน และไฟล์สำคัญ
- สิ่งที่ทดสอบพร้อมผล ไม่ใช้คำว่า “ผ่านครบ” เมื่อทดสอบเฉพาะหน้าแรก
- ข้อจำกัดจริง เช่น ยังไม่มี API key หรือยังไม่ทดสอบ Firebase ด้วยบัญชีจริง
- ลิงก์หน้าเว็บหรือไฟล์ที่ผู้ใช้เปิดตรวจได้

ไม่ commit, push หรือ deploy โดยอนุมานจากคำขอแก้โค้ด และไม่กล่าวว่าปัญหาที่เพียงตรวจพบได้รับการแก้แล้ว
