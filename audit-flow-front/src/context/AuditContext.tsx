import { createContext, useContext, useState, ReactNode } from 'react';
import { AuditData, AuditStatusResponse, BenchmarkResponse } from '@/lib/api';

interface AuditContextType {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  auditStatus: AuditStatusResponse | null;
  setAuditStatus: (status: AuditStatusResponse | null) => void;
  auditData: AuditData | null;
  setAuditData: (data: AuditData | null) => void;
  auditUrl: string | null;
  setAuditUrl: (url: string | null) => void;
  benchmarkData: BenchmarkResponse | null;
  setBenchmarkData: (data: BenchmarkResponse | null) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatusResponse | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [auditUrl, setAuditUrl] = useState<string | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null);

  return (
    <AuditContext.Provider
      value={{
        sessionId,
        setSessionId,
        auditStatus,
        setAuditStatus,
        auditData,
        setAuditData,
        auditUrl,
        setAuditUrl,
        benchmarkData,
        setBenchmarkData,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
}
