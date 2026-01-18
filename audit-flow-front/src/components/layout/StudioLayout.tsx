import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { ProgressHeader } from "./ProgressHeader";
import { BottomBar } from "./BottomBar";

interface StudioLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  progress?: number;
}

export function StudioLayout({ leftPanel, centerPanel, rightPanel, progress }: StudioLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden noise-overlay">
      <Navbar />
      <ProgressHeader progress={progress} />
      
      {/* Main 3-column layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Panel - AI Assistant */}
        <div className="w-80 flex-shrink-0 hidden lg:flex">
          <div className="glass-panel w-full flex flex-col overflow-hidden">
            {leftPanel}
          </div>
        </div>

        {/* Center Panel - Report Viewer */}
        <div className="flex-1 flex">
          <div className="glass-panel w-full flex flex-col overflow-hidden">
            {centerPanel}
          </div>
        </div>

        {/* Right Panel - Audit Controls */}
        <div className="w-80 flex-shrink-0 hidden xl:flex">
          <div className="glass-panel w-full flex flex-col overflow-hidden">
            {rightPanel}
          </div>
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
