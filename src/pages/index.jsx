import React, { lazy, Suspense } from "react";

// Lazy load OrderPage to avoid base44 auth trigger on public route
const OrderPage = lazy(() => import("./OrderPage"));

// Regular imports for admin pages (will be wrapped in Layout with auth)
import Layout from "./Layout.jsx";
import Albaranes from "./Albaranes";
import MenuManagement from "./MenuManagement";

import ApiDiagnostics from "./ApiDiagnostics";

import AttendanceControl from "./AttendanceControl";

import AutomationHub from "./AutomationHub";

import Billing from "./Billing";

import BiloopAgent from "./BiloopAgent";

import BiloopDocuments from "./BiloopDocuments";

import BiloopImport from "./BiloopImport";

import BusinessAnalysis from "./BusinessAnalysis";

import CEOBrain from "./CEOBrain";

import CentralAgent from "./CentralAgent";

import CompanyDocs from "./CompanyDocs";

import Comparator from "./Comparator";

import ConnectionDiagnostics from "./ConnectionDiagnostics";

import Contracts from "./Contracts";

import CronSetup from "./CronSetup";

import Dashboard from "./Dashboard";

import DocumentArchive from "./DocumentArchive";

import EmailProcessor from "./EmailProcessor";

import EmailSetup from "./EmailSetup";

import EmailTriage from "./EmailTriage";

import EmployeeHome from "./EmployeeHome";

import ExecutiveReports from "./ExecutiveReports";

import FinanceDashboard from "./FinanceDashboard";

import GestorFacturas from "./GestorFacturas";

import HRAgent from "./HRAgent";

import HRDocuments from "./HRDocuments";

import Home from "./Home";

import Invoices from "./Invoices";

import KitchenDisplay from "./KitchenDisplay";

import LegalVault from "./LegalVault";

import MutuaManager from "./MutuaManager";

import MyProfile from "./MyProfile";

import Notifications from "./Notifications";

import OrdersDashboard from "./OrdersDashboard";

import Payrolls from "./Payrolls";

import PortalGestoria from "./PortalGestoria";

import PortalLogin from "./PortalLogin";

import ProductInventory from "./ProductInventory";

import ProductionControl from "./ProductionControl";

import Providers from "./Providers";

import RGPDManager from "./RGPDManager";

import RevoDashboard from "./RevoDashboard";

import RevoManual from "./RevoManual";

import RevoSync from "./RevoSync";

import SecurityCameras from "./SecurityCameras";

import Showcase from "./Showcase";

import SmartMailbox from "./SmartMailbox";

import Staff from "./Staff";

import SystemOverview from "./SystemOverview";

import Timesheets from "./Timesheets";

import VacationRequests from "./VacationRequests";

import VeriFactu from "./VeriFactu";

import VoiceCommands from "./VoiceCommands";

import WebSync from "./WebSync";

import WorkerInterface from "./WorkerInterface";

import WorkerMobile from "./WorkerMobile";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Albaranes: Albaranes,
    
    ApiDiagnostics: ApiDiagnostics,
    
    AttendanceControl: AttendanceControl,
    
    AutomationHub: AutomationHub,
    
    Billing: Billing,
    
    BiloopAgent: BiloopAgent,
    
    BiloopDocuments: BiloopDocuments,
    
    BiloopImport: BiloopImport,
    
    BusinessAnalysis: BusinessAnalysis,
    
    CEOBrain: CEOBrain,
    
    CentralAgent: CentralAgent,
    
    CompanyDocs: CompanyDocs,
    
    Comparator: Comparator,
    
    ConnectionDiagnostics: ConnectionDiagnostics,
    
    Contracts: Contracts,
    
    CronSetup: CronSetup,
    
    Dashboard: Dashboard,
    
    DocumentArchive: DocumentArchive,
    
    EmailProcessor: EmailProcessor,
    
    EmailSetup: EmailSetup,
    
    EmailTriage: EmailTriage,
    
    EmployeeHome: EmployeeHome,
    
    ExecutiveReports: ExecutiveReports,
    
    FinanceDashboard: FinanceDashboard,
    
    GestorFacturas: GestorFacturas,
    
    HRAgent: HRAgent,
    
    HRDocuments: HRDocuments,
    
    Home: Home,
    
    Invoices: Invoices,
    
    KitchenDisplay: KitchenDisplay,
    
    LegalVault: LegalVault,
    
    MenuManagement: MenuManagement,
    
    MutuaManager: MutuaManager,
    
    MyProfile: MyProfile,
    
    Notifications: Notifications,
    
    OrdersDashboard: OrdersDashboard,
    
    Payrolls: Payrolls,
    
    PortalGestoria: PortalGestoria,
    
    PortalLogin: PortalLogin,
    
    ProductInventory: ProductInventory,
    
    ProductionControl: ProductionControl,
    
    Providers: Providers,
    
    RGPDManager: RGPDManager,
    
    RevoDashboard: RevoDashboard,
    
    RevoManual: RevoManual,
    
    RevoSync: RevoSync,
    
    SecurityCameras: SecurityCameras,
    
    Showcase: Showcase,
    
    SmartMailbox: SmartMailbox,
    
    Staff: Staff,
    
    SystemOverview: SystemOverview,
    
    Timesheets: Timesheets,
    
    VacationRequests: VacationRequests,
    
    VeriFactu: VeriFactu,
    
    VoiceCommands: VoiceCommands,
    
    WebSync: WebSync,
    
    WorkerInterface: WorkerInterface,
    
    WorkerMobile: WorkerMobile,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Albaranes />} />
                
                
                <Route path="/Albaranes" element={<Albaranes />} />
                
                <Route path="/ApiDiagnostics" element={<ApiDiagnostics />} />
                
                <Route path="/AttendanceControl" element={<AttendanceControl />} />
                
                <Route path="/AutomationHub" element={<AutomationHub />} />
                
                <Route path="/Billing" element={<Billing />} />
                
                <Route path="/BiloopAgent" element={<BiloopAgent />} />
                
                <Route path="/BiloopDocuments" element={<BiloopDocuments />} />
                
                <Route path="/BiloopImport" element={<BiloopImport />} />
                
                <Route path="/BusinessAnalysis" element={<BusinessAnalysis />} />
                
                <Route path="/CEOBrain" element={<CEOBrain />} />
                
                <Route path="/CentralAgent" element={<CentralAgent />} />
                
                <Route path="/CompanyDocs" element={<CompanyDocs />} />
                
                <Route path="/Comparator" element={<Comparator />} />
                
                <Route path="/ConnectionDiagnostics" element={<ConnectionDiagnostics />} />
                
                <Route path="/Contracts" element={<Contracts />} />
                
                <Route path="/CronSetup" element={<CronSetup />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/DocumentArchive" element={<DocumentArchive />} />
                
                <Route path="/EmailProcessor" element={<EmailProcessor />} />
                
                <Route path="/EmailSetup" element={<EmailSetup />} />
                
                <Route path="/EmailTriage" element={<EmailTriage />} />
                
                <Route path="/EmployeeHome" element={<EmployeeHome />} />
                
                <Route path="/ExecutiveReports" element={<ExecutiveReports />} />
                
                <Route path="/FinanceDashboard" element={<FinanceDashboard />} />
                
                <Route path="/GestorFacturas" element={<GestorFacturas />} />
                
                <Route path="/HRAgent" element={<HRAgent />} />
                
                <Route path="/HRDocuments" element={<HRDocuments />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Invoices" element={<Invoices />} />
                
                <Route path="/KitchenDisplay" element={<KitchenDisplay />} />
                
                <Route path="/LegalVault" element={<LegalVault />} />
                
                <Route path="/MenuManagement" element={<MenuManagement />} />
                
                <Route path="/MutuaManager" element={<MutuaManager />} />
                
                <Route path="/MyProfile" element={<MyProfile />} />
                
                <Route path="/Notifications" element={<Notifications />} />
                
                <Route path="/OrdersDashboard" element={<OrdersDashboard />} />
                
                <Route path="/Payrolls" element={<Payrolls />} />
                
                <Route path="/PortalGestoria" element={<PortalGestoria />} />
                
                <Route path="/PortalLogin" element={<PortalLogin />} />
                
                <Route path="/ProductInventory" element={<ProductInventory />} />
                
                <Route path="/ProductionControl" element={<ProductionControl />} />
                
                <Route path="/Providers" element={<Providers />} />
                
                <Route path="/RGPDManager" element={<RGPDManager />} />
                
                <Route path="/RevoDashboard" element={<RevoDashboard />} />
                
                <Route path="/RevoManual" element={<RevoManual />} />
                
                <Route path="/RevoSync" element={<RevoSync />} />
                
                <Route path="/SecurityCameras" element={<SecurityCameras />} />
                
                <Route path="/Showcase" element={<Showcase />} />
                
                <Route path="/SmartMailbox" element={<SmartMailbox />} />
                
                <Route path="/Staff" element={<Staff />} />
                
                <Route path="/SystemOverview" element={<SystemOverview />} />
                
                <Route path="/Timesheets" element={<Timesheets />} />
                
                <Route path="/VacationRequests" element={<VacationRequests />} />
                
                <Route path="/VeriFactu" element={<VeriFactu />} />
                
                <Route path="/VoiceCommands" element={<VoiceCommands />} />
                
                <Route path="/WebSync" element={<WebSync />} />
                
                <Route path="/WorkerInterface" element={<WorkerInterface />} />
                
                <Route path="/WorkerMobile" element={<WorkerMobile />} />
                
            </Routes>
        </Layout>
    );
}

// Public order page wrapper (no Layout)
function PublicOrderPage() {
    return <OrderPage />;
}

// Main router with public and admin routes
function AppRouter() {
    const location = useLocation();
    
    // Check if it's a public route
    if (location.pathname === '/pedir') {
        return <PublicOrderPage />;
    }
    
    // Admin routes with Layout
    const currentPage = _getCurrentPage(location.pathname);
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                <Route path="/" element={<Albaranes />} />
                <Route path="/Albaranes" element={<Albaranes />} />
                <Route path="/ApiDiagnostics" element={<ApiDiagnostics />} />
                <Route path="/AttendanceControl" element={<AttendanceControl />} />
                <Route path="/AutomationHub" element={<AutomationHub />} />
                <Route path="/Billing" element={<Billing />} />
                <Route path="/BiloopAgent" element={<BiloopAgent />} />
                <Route path="/BiloopDocuments" element={<BiloopDocuments />} />
                <Route path="/BiloopImport" element={<BiloopImport />} />
                <Route path="/BusinessAnalysis" element={<BusinessAnalysis />} />
                <Route path="/CEOBrain" element={<CEOBrain />} />
                <Route path="/CentralAgent" element={<CentralAgent />} />
                <Route path="/CompanyDocs" element={<CompanyDocs />} />
                <Route path="/Comparator" element={<Comparator />} />
                <Route path="/ConnectionDiagnostics" element={<ConnectionDiagnostics />} />
                <Route path="/Contracts" element={<Contracts />} />
                <Route path="/CronSetup" element={<CronSetup />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/DocumentArchive" element={<DocumentArchive />} />
                <Route path="/EmailProcessor" element={<EmailProcessor />} />
                <Route path="/EmailSetup" element={<EmailSetup />} />
                <Route path="/EmailTriage" element={<EmailTriage />} />
                <Route path="/EmployeeHome" element={<EmployeeHome />} />
                <Route path="/ExecutiveReports" element={<ExecutiveReports />} />
                <Route path="/FinanceDashboard" element={<FinanceDashboard />} />
                <Route path="/GestorFacturas" element={<GestorFacturas />} />
                <Route path="/HRAgent" element={<HRAgent />} />
                <Route path="/HRDocuments" element={<HRDocuments />} />
                <Route path="/Home" element={<Home />} />
                <Route path="/Invoices" element={<Invoices />} />
                <Route path="/KitchenDisplay" element={<KitchenDisplay />} />
                <Route path="/LegalVault" element={<LegalVault />} />
                <Route path="/MenuManagement" element={<MenuManagement />} />
                <Route path="/MutuaManager" element={<MutuaManager />} />
                <Route path="/MyProfile" element={<MyProfile />} />
                <Route path="/Notifications" element={<Notifications />} />
                <Route path="/OrdersDashboard" element={<OrdersDashboard />} />
                <Route path="/Payrolls" element={<Payrolls />} />
                <Route path="/PortalGestoria" element={<PortalGestoria />} />
                <Route path="/PortalLogin" element={<PortalLogin />} />
                <Route path="/ProductInventory" element={<ProductInventory />} />
                <Route path="/ProductionControl" element={<ProductionControl />} />
                <Route path="/Providers" element={<Providers />} />
                <Route path="/RGPDManager" element={<RGPDManager />} />
                <Route path="/RevoDashboard" element={<RevoDashboard />} />
                <Route path="/RevoManual" element={<RevoManual />} />
                <Route path="/RevoSync" element={<RevoSync />} />
                <Route path="/SecurityCameras" element={<SecurityCameras />} />
                <Route path="/Showcase" element={<Showcase />} />
                <Route path="/SmartMailbox" element={<SmartMailbox />} />
                <Route path="/Staff" element={<Staff />} />
                <Route path="/SystemOverview" element={<SystemOverview />} />
                <Route path="/Timesheets" element={<Timesheets />} />
                <Route path="/VacationRequests" element={<VacationRequests />} />
                <Route path="/VeriFactu" element={<VeriFactu />} />
                <Route path="/VoiceCommands" element={<VoiceCommands />} />
                <Route path="/WebSync" element={<WebSync />} />
                <Route path="/WorkerInterface" element={<WorkerInterface />} />
                <Route path="/WorkerMobile" element={<WorkerMobile />} />
            </Routes>
        </Layout>
    );
}

// Loading component for lazy loaded pages
function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
            </div>
        </div>
    );
}

export default function Pages() {
    return (
        <Router>
            <Routes>
                <Route 
                    path="/pedir" 
                    element={
                        <Suspense fallback={<LoadingSpinner />}>
                            <OrderPage />
                        </Suspense>
                    } 
                />
                <Route path="/*" element={<PagesContent />} />
            </Routes>
        </Router>
    );
}