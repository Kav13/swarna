import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { SetupWizard } from './components/setup/SetupWizard';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { CustomersView } from './views/CustomersView';
import { CustomerProfileView } from './views/CustomerProfileView';
import { NewLoanWizardView } from './views/NewLoanWizardView';
import { BulkLoanEntryView } from './views/BulkLoanEntryView';
import { LoansListView } from './views/LoansListView';
import { LoanDetailsView } from './views/LoanDetailsView';
import { RepaymentModal } from './views/RepaymentModal';
import { ValuationCalculatorView } from './views/ValuationCalculatorView';
import { RatesManagementView } from './views/RatesManagementView';
import { DailyClosingView } from './views/DailyClosingView';
import { ReportsView } from './views/ReportsView';
import { UsersManagementView } from './views/UsersManagementView';
import { AuditLogsView } from './views/AuditLogsView';
import { BackupRestoreView } from './views/BackupRestoreView';
import { SettingsView } from './views/SettingsView';
import { ImportHistoricalLoansView } from './views/ImportHistoricalLoansView';
import { PrintModal, PrintDocType } from './components/print/PrintModal';
import { BusinessSettings } from './types';
import { api } from './api';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, setupRequired, refreshCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Repayment Modal
  const [repaymentModalOpen, setRepaymentModalOpen] = useState<boolean>(false);
  const [repaymentTargetLoanId, setRepaymentTargetLoanId] = useState<string>('');

  // Print Modal
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printDocType, setPrintDocType] = useState<PrintDocType>('PLEDGE_RECEIPT');
  const [printDocData, setPrintDocData] = useState<any>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.api) {
          const s = await window.api.settings.getSettings();
          setSettings(s);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Initializing Vault Security...</span>
        </div>
      </div>
    );
  }

  if (setupRequired) {
    return <SetupWizard onComplete={() => refreshCurrentUser()} />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Printing Handlers
  const openPrint = async (type: PrintDocType, data: any) => {
    setPrintDocType(type);
    setPrintDocData(data);
    setPrintModalOpen(true);
  };

  const handlePrintPledgeReceipt = async (loanId: string) => {
    if (window.api) {
      const loan = await window.api.loans.getLoanById(loanId);
      if (loan) openPrint('PLEDGE_RECEIPT', loan);
    }
  };

  const handlePrintPaymentReceipt = async (paymentId: string) => {
    const targetLid = selectedLoanId || repaymentTargetLoanId;
    if (window.api && targetLid) {
      const pays = await window.api.payments.getPaymentsByLoanId(targetLid);
      const p = pays.find((item: any) => item.id === paymentId);
      const l = await window.api.loans.getLoanById(targetLid);
      if (p && l) {
        openPrint('PAYMENT_RECEIPT', {
          ...p,
          customer_name: l.customer_name,
          remaining_principal_paise: l.principal_outstanding_paise,
        });
      }
    }
  };

  const handlePrintClosureReceipt = async (loanId: string) => {
    if (window.api) {
      const loan = await window.api.loans.getLoanById(loanId);
      if (loan) openPrint('CLOSURE_RECEIPT', loan);
    }
  };

  const handlePrintDailyClosing = async (dateStr: string) => {
    if (window.api) {
      const summary = await window.api.dailyClosing.getDailySummary(dateStr);
      if (summary) openPrint('DAILY_SUMMARY', summary);
    }
  };

  const handleQuickAction = (action: 'NEW_LOAN' | 'NEW_CUSTOMER' | 'RECORD_PAYMENT') => {
    if (action === 'NEW_LOAN') {
      setSelectedCustomerId('');
      setActiveTab('new-loan');
    } else if (action === 'NEW_CUSTOMER') {
      setActiveTab('customers');
    } else if (action === 'RECORD_PAYMENT') {
      setRepaymentTargetLoanId('');
      setRepaymentModalOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          onQuickAction={handleQuickAction}
          onSearchSelectLoan={(loanId) => {
            setSelectedLoanId(loanId);
            setActiveTab('loan-details');
          }}
          onSearchSelectCustomer={(customerId) => {
            setSelectedCustomerId(customerId);
            setActiveTab('customer-profile');
          }}
        />

        {/* Content View Scroll Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab, params) => {
                setActiveTab(tab);
                if (params?.customerId) setSelectedCustomerId(params.customerId);
                if (params?.loanId) setSelectedLoanId(params.loanId);
              }}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              onSelectCustomer={(id) => {
                setSelectedCustomerId(id);
                setActiveTab('customer-profile');
              }}
              onNewLoanForCustomer={(id) => {
                setSelectedCustomerId(id);
                setActiveTab('new-loan');
              }}
            />
          )}

          {activeTab === 'customer-profile' && (
            <CustomerProfileView
              customerId={selectedCustomerId}
              onBack={() => setActiveTab('customers')}
              onSelectLoan={(lid) => {
                setSelectedLoanId(lid);
                setActiveTab('loan-details');
              }}
              onNewLoan={(cid) => {
                setSelectedCustomerId(cid);
                setActiveTab('new-loan');
              }}
              onRecordPayment={(lid) => {
                setRepaymentTargetLoanId(lid || '');
                setRepaymentModalOpen(true);
              }}
              onPrintStatement={(cid) => {
                // Statement preview
                if (window.api) {
                  window.api.customers.getCustomerProfile(cid).then((prof) => {
                    if (prof) openPrint('CUSTOMER_STATEMENT', prof);
                  });
                }
              }}
            />
          )}

          {activeTab === 'new-loan' && (
            <NewLoanWizardView
              initialCustomerId={selectedCustomerId}
              onLoanCreated={(id) => {
                setSelectedLoanId(id);
                setActiveTab('loan-details');
                handlePrintPledgeReceipt(id);
              }}
              onCancel={() => setActiveTab('loans')}
            />
          )}

          {activeTab === 'bulk-loan' && (
            <BulkLoanEntryView
              onLoanCreated={(id) => {
                setSelectedLoanId(id);
                setActiveTab('loan-details');
                handlePrintPledgeReceipt(id);
              }}
              onCancel={() => setActiveTab('loans')}
            />
          )}

          {activeTab === 'loans' && (
            <LoansListView
              onSelectLoan={(id) => {
                setSelectedLoanId(id);
                setActiveTab('loan-details');
              }}
              onNewLoan={() => setActiveTab('new-loan')}
            />
          )}

          {activeTab === 'loan-details' && (
            <LoanDetailsView
              loanId={selectedLoanId}
              onBack={() => setActiveTab('loans')}
              onRecordPayment={(lid) => {
                setRepaymentTargetLoanId(lid);
                setRepaymentModalOpen(true);
              }}
              onPrintPledgeReceipt={handlePrintPledgeReceipt}
              onPrintPaymentReceipt={handlePrintPaymentReceipt}
              onPrintClosureReceipt={handlePrintClosureReceipt}
              onSelectCustomer={(cid) => {
                setSelectedCustomerId(cid);
                setActiveTab('customer-profile');
              }}
            />
          )}

          {activeTab === 'payments' && (
            <LoansListView
              initialStatus="ACTIVE"
              onSelectLoan={(id) => {
                setSelectedLoanId(id);
                setActiveTab('loan-details');
              }}
              onNewLoan={() => setActiveTab('new-loan')}
            />
          )}

          {activeTab === 'valuation' && <ValuationCalculatorView />}

          {activeTab === 'rates' && <RatesManagementView />}

          {activeTab === 'daily-closing' && (
            <DailyClosingView onPrintDailySummary={handlePrintDailyClosing} />
          )}

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'users' && <UsersManagementView />}

          {activeTab === 'settings' && <SettingsView />}

          {activeTab === 'backup' && <BackupRestoreView />}

          {activeTab === 'import-loans' && (
            <ImportHistoricalLoansView onNavigateToLoans={() => setActiveTab('loans')} />
          )}

          {activeTab === 'audit' && <AuditLogsView />}
        </main>
      </div>

      {/* Repayment Waterfall Modal */}
      <RepaymentModal
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        preselectedLoanId={repaymentTargetLoanId}
        onPaymentSuccess={(paymentId, isClosed) => {
          if (repaymentTargetLoanId) {
            handlePrintPaymentReceipt(paymentId);
          }
        }}
      />

      {/* Global Document Print Modal */}
      {settings && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          type={printDocType}
          data={printDocData}
          settings={settings}
        />
      )}
    </div>
  );
};
