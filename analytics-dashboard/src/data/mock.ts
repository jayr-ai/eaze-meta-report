export const mockKPIs = [
  {
    id: 'students',
    label: 'Total Students',
    value: '1,248',
    delta: 5.6,
    icon: 'Users',
    gradient: 'from-blue-500 to-blue-700',
    bgGradient: 'from-blue-600/20 to-blue-800/20',
  },
  {
    id: 'gpa',
    label: 'Average GPA',
    value: '1.82',
    delta: 0.12,
    icon: 'Star',
    gradient: 'from-purple-500 to-purple-700',
    bgGradient: 'from-purple-600/20 to-purple-800/20',
  },
  {
    id: 'passrate',
    label: 'Pass Rate',
    value: '87.4%',
    delta: 4.3,
    icon: 'CheckCircle',
    gradient: 'from-green-500 to-green-700',
    bgGradient: 'from-green-600/20 to-green-800/20',
  },
  {
    id: 'attendance',
    label: 'Attendance Rate',
    value: '92.1%',
    delta: 3.8,
    icon: 'Calendar',
    gradient: 'from-orange-500 to-orange-700',
    bgGradient: 'from-orange-600/20 to-orange-800/20',
  },
  {
    id: 'revenue',
    label: 'Total Revenue',
    value: '₱2.45M',
    delta: 12.7,
    icon: 'DollarSign',
    gradient: 'from-cyan-500 to-cyan-700',
    bgGradient: 'from-cyan-600/20 to-cyan-800/20',
  },
];

export const mockPerformanceOverview = [
  { month: 'Dec', gpa: 1.65 },
  { month: 'Jan', gpa: 1.7 },
  { month: 'Feb', gpa: 1.75 },
  { month: 'Mar', gpa: 1.8 },
  { month: 'Apr', gpa: 1.7 },
  { month: 'May', gpa: 1.82 },
];

export const mockGradeDistribution = [
  { name: '4.0 (Excellent)', value: 8.1, color: '#3B82F6' },
  { name: '3.0 - 3.99 (Very Good)', value: 21.6, color: '#8B5CF6' },
  { name: '2.0 - 2.99 (Good)', value: 33.7, color: '#F59E0B' },
  { name: '1.0 - 1.99 (Satisfactory)', value: 24.3, color: '#FB923C' },
  { name: '0 - 0.99 (Needs Improvement)', value: 12.3, color: '#A78BFA' },
];

export const mockAttendanceOverview = {
  percentage: 92.1,
  delta: 3.8,
};

export const mockTopCourses = [
  { name: 'Data Structures', gpa: 2.48 },
  { name: 'Discrete Mathematics', gpa: 2.35 },
  { name: 'Database Systems', gpa: 2.28 },
  { name: 'Operating Systems', gpa: 2.15 },
  { name: 'Software Engineering', gpa: 2.05 },
];

export const mockStudentsByYear = [
  { name: '1st Year', value: 25.6, color: '#8B5CF6' },
  { name: '2nd Year', value: 24.1, color: '#06B6D4' },
  { name: '3rd Year', value: 26.7, color: '#10B981' },
  { name: '4th Year', value: 23.6, color: '#F59E0B' },
];

export const mockRevenueByMonth = [
  { month: 'Dec', revenue: 1.65 },
  { month: 'Jan', revenue: 1.82 },
  { month: 'Feb', revenue: 1.95 },
  { month: 'Mar', revenue: 2.1 },
  { month: 'Apr', revenue: 2.17 },
  { month: 'May', revenue: 2.45 },
];

export const mockStudentPerformance = [
  {
    id: '2024001',
    name: 'Juan Dela Cruz',
    course: 'BSIT',
    gpa: 2.45,
    status: 'Passed',
  },
  {
    id: '2024002',
    name: 'Maria Santos',
    course: 'BSCS',
    gpa: 1.95,
    status: 'Passed',
  },
  {
    id: '2024003',
    name: 'Peter Johnson',
    course: 'BSIT',
    gpa: 1.75,
    status: 'Passed',
  },
  {
    id: '2024004',
    name: 'Angela Reyes',
    course: 'BSCS',
    gpa: 1.2,
    status: 'On Probation',
  },
  {
    id: '2024005',
    name: 'Mark Salvador',
    course: 'BSIT',
    gpa: 0.85,
    status: 'Failed',
  },
];

export const mockAlerts = [
  {
    id: '1',
    type: 'warning',
    title: '5 students are on probation',
    subtitle: 'Low academic performance.',
    icon: 'AlertTriangle',
  },
  {
    id: '2',
    type: 'danger',
    title: '2 students have low attendance',
    subtitle: 'Attendance below 75%.',
    icon: 'AlertCircle',
  },
  {
    id: '3',
    type: 'info',
    title: 'Midterm grades submission',
    subtitle: 'Deadline on June 5, 2024.',
    icon: 'Info',
  },
];

export const mockQuickActions = [
  { id: '1', label: 'Add Student', icon: 'UserPlus' },
  { id: '2', label: 'Upload Grades', icon: 'Upload' },
  { id: '3', label: 'Generate Report', icon: 'FileText' },
  { id: '4', label: 'Send Announcement', icon: 'Send' },
];
