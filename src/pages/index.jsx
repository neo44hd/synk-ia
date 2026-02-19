import Layout from "./Layout.jsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ROUTE_PERMISSIONS } from "@/config/roles";

import Albaranes from "./Albaranes";
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
import SynkiaBrainPage from "./SynkiaBrainPage";

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
    SynkiaBrainPage: SynkiaBrainPage,
}

// Rutas públicas (sin autenticación)
const PUBLIC_ROUTES = ['/pedir', '/OrdersDashboard', '/PortalLogin'];

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

// Helper para verificar si una ruta es pública
function isPublicRoute(path) {
    return PUBLIC_ROUTES.some(route => 
        path === route || path.toLowerCase() === route.toLowerCase()
    );
}

// Componente wrapper para rutas protegidas
function ProtectedPageRoute({ path, element }) {
    const isPublic = isPublicRoute(path);
    
    return (
        <ProtectedRoute isPublic={isPublic}>
            {element}
        </ProtectedRoute>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const isPublic = isPublicRoute(location.pathname);
    
    // Si es ruta pública, no envolver en Layout
    if (isPublic) {
        return (
            <Routes>
                <Route path="/pedir" element={<OrdersDashboard />} />
                <Route path="/OrdersDashboard" element={<OrdersDashboard />} />
                <Route path="/PortalLogin" element={<PortalLogin />} />
            </Routes>
        );
    }
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                <Route path="/" element={<ProtectedPageRoute path="/" element={<Albaranes />} />} />
                
                <Route path="/Albaranes" element={<ProtectedPageRoute path="/Albaranes" element={<Albaranes />} />} />
                <Route path="/ApiDiagnostics" element={<ProtectedPageRoute path="/ApiDiagnostics" element={<ApiDiagnostics />} />} />
                <Route path="/AttendanceControl" element={<ProtectedPageRoute path="/AttendanceControl" element={<AttendanceControl />} />} />
                <Route path="/AutomationHub" element={<ProtectedPageRoute path="/AutomationHub" element={<AutomationHub />} />} />
                <Route path="/Billing" element={<ProtectedPageRoute path="/Billing" element={<Billing />} />} />
                <Route path="/BiloopAgent" element={<ProtectedPageRoute path="/BiloopAgent" element={<BiloopAgent />} />} />
                <Route path="/BiloopDocuments" element={<ProtectedPageRoute path="/BiloopDocuments" element={<BiloopDocuments />} />} />
                <Route path="/BiloopImport" element={<ProtectedPageRoute path="/BiloopImport" element={<BiloopImport />} />} />
                <Route path="/BusinessAnalysis" element={<ProtectedPageRoute path="/BusinessAnalysis" element={<BusinessAnalysis />} />} />
                <Route path="/CEOBrain" element={<ProtectedPageRoute path="/CEOBrain" element={<CEOBrain />} />} />
                <Route path="/CentralAgent" element={<ProtectedPageRoute path="/CentralAgent" element={<CentralAgent />} />} />
                <Route path="/CompanyDocs" element={<ProtectedPageRoute path="/CompanyDocs" element={<CompanyDocs />} />} />
                <Route path="/Comparator" element={<ProtectedPageRoute path="/Comparator" element={<Comparator />} />} />
                <Route path="/ConnectionDiagnostics" element={<ProtectedPageRoute path="/ConnectionDiagnostics" element={<ConnectionDiagnostics />} />} />
                <Route path="/Contracts" element={<ProtectedPageRoute path="/Contracts" element={<Contracts />} />} />
                <Route path="/CronSetup" element={<ProtectedPageRoute path="/CronSetup" element={<CronSetup />} />} />
                <Route path="/Dashboard" element={<ProtectedPageRoute path="/Dashboard" element={<Dashboard />} />} />
                <Route path="/DocumentArchive" element={<ProtectedPageRoute path="/DocumentArchive" element={<DocumentArchive />} />} />
                <Route path="/EmailProcessor" element={<ProtectedPageRoute path="/EmailProcessor" element={<EmailProcessor />} />} />
                <Route path="/EmailSetup" element={<ProtectedPageRoute path="/EmailSetup" element={<EmailSetup />} />} />
                <Route path="/EmailTriage" element={<ProtectedPageRoute path="/EmailTriage" element={<EmailTriage />} />} />
                <Route path="/EmployeeHome" element={<ProtectedPageRoute path="/EmployeeHome" element={<EmployeeHome />} />} />
                <Route path="/ExecutiveReports" element={<ProtectedPageRoute path="/ExecutiveReports" element={<ExecutiveReports />} />} />
                <Route path="/FinanceDashboard" element={<ProtectedPageRoute path="/FinanceDashboard" element={<FinanceDashboard />} />} />
                <Route path="/GestorFacturas" element={<ProtectedPageRoute path="/GestorFacturas" element={<GestorFacturas />} />} />
                <Route path="/HRAgent" element={<ProtectedPageRoute path="/HRAgent" element={<HRAgent />} />} />
                <Route path="/HRDocuments" element={<ProtectedPageRoute path="/HRDocuments" element={<HRDocuments />} />} />
                <Route path="/Home" element={<ProtectedPageRoute path="/Home" element={<Home />} />} />
                <Route path="/Invoices" element={<ProtectedPageRoute path="/Invoices" element={<Invoices />} />} />
                <Route path="/KitchenDisplay" element={<ProtectedPageRoute path="/KitchenDisplay" element={<KitchenDisplay />} />} />
                <Route path="/LegalVault" element={<ProtectedPageRoute path="/LegalVault" element={<LegalVault />} />} />
                <Route path="/MutuaManager" element={<ProtectedPageRoute path="/MutuaManager" element={<MutuaManager />} />} />
                <Route path="/MyProfile" element={<ProtectedPageRoute path="/MyProfile" element={<MyProfile />} />} />
                <Route path="/Notifications" element={<ProtectedPageRoute path="/Notifications" element={<Notifications />} />} />
                <Route path="/OrdersDashboard" element={<ProtectedPageRoute path="/OrdersDashboard" element={<OrdersDashboard />} />} />
                <Route path="/Payrolls" element={<ProtectedPageRoute path="/Payrolls" element={<Payrolls />} />} />
                <Route path="/PortalGestoria" element={<ProtectedPageRoute path="/PortalGestoria" element={<PortalGestoria />} />} />
                <Route path="/PortalLogin" element={<PortalLogin />} />
                <Route path="/ProductInventory" element={<ProtectedPageRoute path="/ProductInventory" element={<ProductInventory />} />} />
                <Route path="/ProductionControl" element={<ProtectedPageRoute path="/ProductionControl" element={<ProductionControl />} />} />
                <Route path="/Providers" element={<ProtectedPageRoute path="/Providers" element={<Providers />} />} />
                <Route path="/RGPDManager" element={<ProtectedPageRoute path="/RGPDManager" element={<RGPDManager />} />} />
                <Route path="/RevoDashboard" element={<ProtectedPageRoute path="/RevoDashboard" element={<RevoDashboard />} />} />
                <Route path="/RevoManual" element={<ProtectedPageRoute path="/RevoManual" element={<RevoManual />} />} />
                <Route path="/RevoSync" element={<ProtectedPageRoute path="/RevoSync" element={<RevoSync />} />} />
                <Route path="/SecurityCameras" element={<ProtectedPageRoute path="/SecurityCameras" element={<SecurityCameras />} />} />
                <Route path="/Showcase" element={<ProtectedPageRoute path="/Showcase" element={<Showcase />} />} />
                <Route path="/SmartMailbox" element={<ProtectedPageRoute path="/SmartMailbox" element={<SmartMailbox />} />} />
                <Route path="/Staff" element={<ProtectedPageRoute path="/Staff" element={<Staff />} />} />
                <Route path="/SystemOverview" element={<ProtectedPageRoute path="/SystemOverview" element={<SystemOverview />} />} />
                <Route path="/Timesheets" element={<ProtectedPageRoute path="/Timesheets" element={<Timesheets />} />} />
                <Route path="/VacationRequests" element={<ProtectedPageRoute path="/VacationRequests" element={<VacationRequests />} />} />
                <Route path="/VeriFactu" element={<ProtectedPageRoute path="/VeriFactu" element={<VeriFactu />} />} />
                <Route path="/VoiceCommands" element={<ProtectedPageRoute path="/VoiceCommands" element={<VoiceCommands />} />} />
                <Route path="/WebSync" element={<ProtectedPageRoute path="/WebSync" element={<WebSync />} />} />
                <Route path="/WorkerInterface" element={<ProtectedPageRoute path="/WorkerInterface" element={<WorkerInterface />} />} />
                <Route path="/WorkerMobile" element={<ProtectedPageRoute path="/WorkerMobile" element={<WorkerMobile />} />} />
                <Route path="/SynkiaBrainPage" element={<ProtectedPageRoute path="/SynkiaBrainPage" element={<SynkiaBrainPage />} />} />
                
                {/* Ruta pública /pedir */}
                <Route path="/pedir" element={<OrdersDashboard />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <AuthProvider>
                <PagesContent />
            </AuthProvider>
        </Router>
    );
}
