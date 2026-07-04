# ATA & LTA ERP Use Case Diagram — Lucidchart AI Prompt

## Prompt

Generate a UML Use Case Diagram for **"ATA & LTA Accounting Firm ERP: A Dual-Entity Workflow, Billing, and Document Management System."**

**Style:** Standard UML 2.5 notation. Stick figures for actors, ellipses for use cases, rectangle for system boundary. Clean academic layout with left-to-right flow. Group related use cases by functional area within the boundary.

---

## System Boundary

- Large rectangle labeled **"ATA & LTA ERP System"**

---

## Actors (Stick Figures)

| Position | Actor | Type | Description |
|----------|-------|------|-------------|
| Far left (top) | **"Staff / Employee"** | Primary | Submits work, files expenses, logs time, uploads documents |
| Left (middle) | **"Manager"** | Secondary | Reviews and approves Staff submissions, edits records |
| Left (bottom) | **"Admin"** | Secondary | Full system access, user management, data reset, audit |
| Far left (bottom) | **"Viewer"** | Secondary | Read-only access across all modules |

---

## Use Cases (Ellipses inside the system boundary)

### [Authentication & Access — top-left area]

1. **"Login"** (<<include>> "Authenticate User")
2. **"Switch Entity"** (toggle between ATA / LTA / ALL)
3. **"Logout"**

---

### [Dashboard — upper-left area]

4. **"View Dashboard"**
5. **"View KPI Widgets"** (Active WRs, Total Clients, Disbursement Summary)
6. **"View Revenue vs. Disbursement Chart"**

---

### [Client Management — left area]

7. **"View Client List"**
8. **"Search Clients"**
9. **"Create Client"**
10. **"Edit Client"**
11. **"Archive Client"**
12. **"View Archived Clients"**
13. **"Assign Point of Contact"**

---

### [Operations / Workflow — center-left area]

14. **"Create Work Request"** (<<include>> "Check Client Assignment")
15. **"Edit Work Request"**
16. **"View Work Request Detail"**
17. **"Route Work Request"** (6-stage pipeline: Draft → Pre-processing → Processing → Billing → Disbursement → Completed) (<<include>> "Validate Phase Requirements")
18. **"Cancel Work Request"**
19. **"Restore Archived Work Request"**
20. **"Create Task"**
21. **"Edit Task"**
22. **"Assign Task to Employee"**
23. **"Log Time on Task"**
24. **"Upload Task Document"**
25. **"Set Task Dependency"** (DAG predecessor selection)
26. **"Create Retainer Template"**
27. **"Generate from Retainer Template"**

---

### [Billing — center area]

28. **"Create Sales Invoice"** (<<include>> "Validate Line Items")
29. **"Edit Invoice"**
30. **"View Invoice Detail"**
31. **"Record Payment"** (<<include>> "Update Invoice Balance")
32. **"Print BIR-Compliant Invoice PDF"**
33. **"Print Voucher PDF"** (no-header receipt)
34. **"View Aging Report"** (0–30, 31–60, 61–90, 90+ days)
35. **"Move Invoice to Trash"**
36. **"Restore Invoice from Trash"**
37. **"View Trash"**
38. **"Create Billing Template"**
39. **"Generate from Billing Template"**

---

### [Disbursement — center-right area]

40. **"File Expense"** (<<include>> "Check Fund Source" — Firm Fund vs Client Fund)
41. **"Edit Expense"**
42. **"View Expense Detail"**
43. **"Approve Expense"** (Admin/Manager — 2-tier for Firm Fund, 1-tier for Client Fund)
44. **"Reject Expense"**
45. **"Release Funds"** (Payment Handler)
46. **"Generate Expense PDF"**
47. **"Generate Disbursement Voucher PDF"**
48. **"View Summary Report"**
49. **"Create Disbursement Template"**
50. **"Generate from Disbursement Template"**

---

### [Document Management System (DMS) — right area]

51. **"Upload Document"**
52. **"Edit Document Metadata"**
53. **"View Document Detail"**
54. **"Transition Document Lifecycle"** (collected → with_documentations → scanned → in_envelope → stored)
55. **"Record Handover Log"** (physical original copy to client)
56. **"Add Admin Comment"**
57. **"Label Envelope"** (auto-generate ENVELOPE-[clientId]-[sequence])

---

### [Transmittal — far right area]

58. **"Create Transmittal"** (<<include>> "Select Documents from DMS")
59. **"Edit Transmittal"**
60. **"View Transmittal Detail"**
61. **"Generate Transmittal Letter PDF"**
62. **"Acknowledge Receipt"** ("Received By" + date)

---

### [Reports — upper-right area]

63. **"View Analytics Dashboard"** (<<include>> "Fetch Statistics")
64. **"View Daily Task Report"**
65. **"View Weekly Performance Summary"**
66. **"View Monthly Pending Tasks"**

---

### [Admin Panel — far right area]

67. **"Create User Account"**
68. **"Edit User Account"**
69. **"Deactivate User"**
70. **"View Audit Log"**
71. **"Review Pending Approvals"** (Admin Review Gate — side-by-side diff)
72. **"Approve Pending Change"**
73. **"Reject Pending Change"**
74. **"Reset Data to Seed"**

---

## Relationships (Solid Lines: Actor → Use Case)

### Staff / Employee (connected to use cases 1–3, 7–8, 14–27, 28–30, 31, 40–42, 51–54, 58–59)

- **Can perform:** Login, Switch Entity, Logout, View Client List, Search Clients, Create Work Request, Edit Work Request, View Work Request Detail, Create Task, Edit Task, Assign Task, Log Time on Task, Upload Task Document, Set Task Dependency, Create Retainer Template, Generate from Retainer Template, Create Sales Invoice, Edit Invoice, View Invoice Detail, Record Payment, File Expense, Edit Expense, View Expense Detail, Upload Document, Edit Document Metadata, View Document Detail, Transition Document Lifecycle, Create Transmittal, Edit Transmittal

- **Cannot perform (requires Manager/Admin):** Approve Expense, Reject Expense, Release Funds, Route Work Request past certain gates, Create/Edit Users, Approve/Reject Pending Changes, View Reports

### Manager (connected to use cases 1–3, 7–13, 14–27, 28–39, 40–50, 51–57, 58–62, 63–66, 71–73)

- **Can perform:** Everything Staff can, plus: Edit Client, Archive Client, View Archived Clients, Assign Point of Contact, Cancel Work Request, Restore Archived Work Request, Route Work Request, Move/Restore Invoice from Trash, View Trash, Approve Expense, Reject Expense, Release Funds, Generate Expense/Voucher PDFs, View Summary Report, Record Handover Log, Add Admin Comment, Label Envelope, Generate Transmittal Letter PDF, Acknowledge Receipt, View Analytics Dashboard, View Daily/Weekly/Monthly Reports, Review/Approve/Reject Pending Approvals

### Admin (connected to ALL use cases 1–74)

- **Can perform:** Everything Manager can, plus: Create User Account, Edit User Account, Deactivate User, View Audit Log, Reset Data to Seed
- **Special:** Sees combined ATA + LTA data regardless of entity switcher

### Viewer (connected to use cases 1–3, 7–8, 16, 28–30, 40–42, 51–53, 58–60)

- **Can perform:** Login, Switch Entity, Logout, View Client List, Search Clients, View Work Request Detail, View Invoice Detail, View Expense Detail, View Document Detail, View Transmittal Detail
- **Cannot perform:** Any create, edit, approve, or route actions

---

## Include Relationships (Dashed arrows with open arrowhead, labeled <<include>>)

| Source Use Case | <<include>> | Target Use Case |
|---|---|---|
| **"Login"** | --<<include>>--> | **"Authenticate User"** |
| **"Create Work Request"** | --<<include>>--> | **"Check Client Assignment"** |
| **"Route Work Request"** | --<<include>>--> | **"Validate Phase Requirements"** |
| **"Create Sales Invoice"** | --<<include>>--> | **"Validate Line Items"** |
| **"Record Payment"** | --<<include>>--> | **"Update Invoice Balance"** |
| **"File Expense"** | --<<include>>--> | **"Check Fund Source"** |
| **"Create Transmittal"** | --<<include>>--> | **"Select Documents from DMS"** |
| **"View Analytics Dashboard"** | --<<include>>--> | **"Fetch Statistics"** |

---

## Extend Relationships (Dashed arrows with open arrowhead, labeled <<extend>>)

| Source Use Case | <<extend>> | Target Use Case | Condition |
|---|---|---|---|
| **"Create Sales Invoice"** | --<<extend>>--> | **"Link Invoice to Work Request"** | when invoice is for a specific work request |
| **"File Expense"** | --<<extend>>--> | **"Link Expense to Work Request"** | when expense is client-funded and tied to a WR |
| **"Route Work Request"** | --<<extend>>--> | **"Auto-Create Linked Invoice"** | when routing a billing-phase task and no invoice exists |
| **"Route Work Request"** | --<<extend>>--> | **"Auto-Create Linked Disbursement"** | when routing an expense-phase task and no disbursement exists |
| **"Log Time on Task"** | --<<extend>>--> | **"Trigger End-of-Day Reminder"** | when 5:00 PM Manila time and missing today's log |

---

## Layout Instructions

- **Left side:** Authentication, Dashboard, Client Management, Operations/Workflow (primary daily-use modules).
- **Center:** Billing, Disbursement (financial modules).
- **Right side:** DMS, Transmittal, Reports, Admin (secondary/support modules).
- **Actors:** Place Staff stick figure on the far left (closest to primary modules). Manager below Staff. Admin below Manager. Viewer at the very bottom left.
- **Grouping:** Use faint dashed rectangles or UML package notation inside the system boundary to group: "Authentication", "Client Mgmt", "Workflow", "Billing", "Disbursement", "DMS", "Transmittal", "Reports", "Admin".
- **Spacing:** Keep at least 1.5cm between use case ellipses. Avoid crossing association lines where possible.
- **Labels:** Place `<<include>>` and `<<extend>>` labels horizontally centered along their dashed arrows.
- **Direction:** `<<include>>` arrows point FROM the base use case TO the included use case. `<<extend>>` arrows point FROM the extending use case TO the base use case.

---

## Diagram Summary

| Element | Count |
|---|---|
| **Actors** | 4 (Staff, Manager, Admin, Viewer) |
| **Modules / Functional Areas** | 9 (Auth, Clients, Workflow, Billing, Disbursement, DMS, Transmittal, Reports, Admin) |
| **Total Use Cases** | 74 |
| **<<include>> Relationships** | 8 |
| **<<extend>> Relationships** | 5 |
| **Actor-Use Case Associations** | ~90 (varies by role permissions) |

---

*Prompt prepared for Lucidchart AI / Diagram Generator. Source: ATA & LTA Accounting Firm ERP Prototype — complete codebase review.*
