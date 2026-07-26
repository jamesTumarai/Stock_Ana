import React from 'react';
import { motion } from 'motion/react';
import { FadingVideo } from './components/FadingVideo';
import { BlurText } from './components/BlurText';
import { ArrowUpRight, Play, FileText, Activity, ShieldAlert } from 'lucide-react';

export function LandingView({ language = 'English' }: { language?: string }) {
  const isThai = language === 'Thai';
  
  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar bg-transparent">
      
      {/* Section 1 — Hero */}
      <div className="relative w-full min-h-[100dvh] flex flex-col justify-center items-center overflow-hidden z-0">
        
        <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center pt-32 md:pt-40 px-4 text-center">
          
          <motion.div 
            initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease: "easeOut" }}
            className="liquid-glass rounded-full flex items-center pr-3 mb-6 max-w-full"
          >
            <span className="bg-white text-black px-3 py-1 text-xs font-semibold rounded-full mr-3">New</span>
            <span className="text-sm text-white/90 truncate">
              {isThai ? "ระบบวิเคราะห์หุ้นด้วย AI" : "AI-Powered Stock Analysis"}
            </span>
          </motion.div>
          
          <BlurText 
            text={isThai ? "Lumina\nวิเคราะห์หุ้นด้วย AI" : "Lumina\nAI Stock Analysis"}
            className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white leading-[0.95] max-w-4xl justify-center tracking-[-1px] md:tracking-[-2px]"
          />
          
          <motion.p 
            initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ delay: 0.8, ease: "easeOut" }}
            className="mt-6 text-sm md:text-base text-white max-w-2xl font-body font-light leading-tight px-4"
          >
            {isThai 
              ? "วิเคราะห์หุ้น เจาะลึกงบการเงิน และประเมินมูลค่าบริษัทได้อย่างแม่นยำ ด้วยพลังของ AI ที่ดึงข้อมูลเชิงลึกจากแหล่งข้อมูลโดยตรง" 
              : "Analyze stocks, dive deep into financial statements, and value companies accurately with AI-driven insights pulled directly from the source."}
          </motion.p>
          
          <motion.div 
            initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ delay: 1.1, ease: "easeOut" }}
            className="flex items-center gap-6 mt-8"
          >
            <button 
              className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium text-white flex items-center gap-1 hover:bg-white/10 transition-colors"
              onClick={() => {
                const input = document.querySelector('input[placeholder="US TICKER"]') as HTMLInputElement;
                if (input) input.focus();
              }}
            >
              {isThai ? "ค้นหาหุ้นสหรัฐฯ" : "Search US Ticker"} <ArrowUpRight className="h-5 w-5" />
            </button>
          </motion.div>
          
          <motion.div 
            initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ delay: 1.3, ease: "easeOut" }}
            className="flex flex-wrap justify-center items-stretch gap-4 mt-12"
          >
            <div className="liquid-glass p-5 w-[220px] rounded-[1.25rem] flex flex-col items-start text-left">
              <Activity className="w-7 h-7 text-white mb-auto" />
              <div className="mt-8">
                <div className="font-heading italic text-white text-4xl tracking-[-1px] leading-none">Real-time</div>
                <div className="text-xs text-white font-body font-light mt-2">Market Data & Trends</div>
              </div>
            </div>
            <div className="liquid-glass p-5 w-[220px] rounded-[1.25rem] flex flex-col items-start text-left">
              <FileText className="w-7 h-7 text-white mb-auto" />
              <div className="mt-8">
                <div className="font-heading italic text-white text-4xl tracking-[-1px] leading-none">In-depth</div>
                <div className="text-xs text-white font-body font-light mt-2">Financial Reports</div>
              </div>
            </div>
          </motion.div>
          
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="relative z-10 flex flex-col items-center gap-4 pb-64 md:pb-40 mt-12 w-full"
        >
          <div className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white">
            {isThai ? "วิเคราะห์ข้อมูลจากตลาดหลักทรัพย์สหรัฐอเมริกา" : "Analyzing data from US stock exchanges"}
          </div>
          <div className="flex flex-wrap justify-center font-heading italic text-white text-2xl md:text-3xl tracking-tight gap-8 md:gap-16 opacity-80">
            <span>NYSE</span> <span>·</span> <span>NASDAQ</span> <span>·</span> <span>AMEX</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
