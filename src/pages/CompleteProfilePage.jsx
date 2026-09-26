import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

// Comprehensive Directory of Top World Universities (QS & THE Global Top Institutions + Leading Regional Universities)
const TOP_UNIVERSITIES = [
  // ── United States (Ivy League, Top Tier Research & Liberal Arts) ──
  { name: "Massachusetts Institute of Technology (MIT)", country: "United States", code: "US" },
  { name: "Harvard University", country: "United States", code: "US" },
  { name: "Stanford University", country: "United States", code: "US" },
  { name: "California Institute of Technology (Caltech)", country: "United States", code: "US" },
  { name: "Princeton University", country: "United States", code: "US" },
  { name: "Yale University", country: "United States", code: "US" },
  { name: "Columbia University", country: "United States", code: "US" },
  { name: "University of Chicago", country: "United States", code: "US" },
  { name: "University of Pennsylvania (UPenn)", country: "United States", code: "US" },
  { name: "Cornell University", country: "United States", code: "US" },
  { name: "University of California, Berkeley (UC Berkeley)", country: "United States", code: "US" },
  { name: "University of California, Los Angeles (UCLA)", country: "United States", code: "US" },
  { name: "University of California, San Diego (UCSD)", country: "United States", code: "US" },
  { name: "Johns Hopkins University", country: "United States", code: "US" },
  { name: "Northwestern University", country: "United States", code: "US" },
  { name: "University of Michigan, Ann Arbor", country: "United States", code: "US" },
  { name: "Carnegie Mellon University (CMU)", country: "United States", code: "US" },
  { name: "Duke University", country: "United States", code: "US" },
  { name: "New York University (NYU)", country: "United States", code: "US" },
  { name: "Brown University", country: "United States", code: "US" },
  { name: "Dartmouth College", country: "United States", code: "US" },
  { name: "University of Washington", country: "United States", code: "US" },
  { name: "University of Texas at Austin", country: "United States", code: "US" },
  { name: "Georgia Institute of Technology (Georgia Tech)", country: "United States", code: "US" },
  { name: "University of Illinois Urbana-Champaign (UIUC)", country: "United States", code: "US" },
  { name: "University of Wisconsin-Madison", country: "United States", code: "US" },
  { name: "Boston University", country: "United States", code: "US" },
  { name: "University of Southern California (USC)", country: "United States", code: "US" },
  { name: "Purdue University", country: "United States", code: "US" },
  { name: "Rice University", country: "United States", code: "US" },
  { name: "Vanderbilt University", country: "United States", code: "US" },
  { name: "Georgetown University", country: "United States", code: "US" },
  { name: "University of North Carolina at Chapel Hill (UNC)", country: "United States", code: "US" },
  { name: "University of Virginia (UVA)", country: "United States", code: "US" },
  { name: "Tufts University", country: "United States", code: "US" },
  { name: "Emory University", country: "United States", code: "US" },
  { name: "University of California, Davis (UC Davis)", country: "United States", code: "US" },
  { name: "University of California, Santa Barbara (UCSB)", country: "United States", code: "US" },
  { name: "University of California, Irvine (UCI)", country: "United States", code: "US" },
  { name: "University of Florida", country: "United States", code: "US" },
  { name: "University of Minnesota Twin Cities", country: "United States", code: "US" },
  { name: "Ohio State University", country: "United States", code: "US" },
  { name: "Penn State University", country: "United States", code: "US" },
  { name: "University of Maryland, College Park", country: "United States", code: "US" },
  { name: "Texas A&M University", country: "United States", code: "US" },
  { name: "University of Pittsburgh", country: "United States", code: "US" },
  { name: "University of Colorado Boulder", country: "United States", code: "US" },
  { name: "Boston College", country: "United States", code: "US" },
  { name: "Northeastern University", country: "United States", code: "US" },
  { name: "Case Western Reserve University", country: "United States", code: "US" },
  { name: "Wake Forest University", country: "United States", code: "US" },
  { name: "Indiana University Bloomington", country: "United States", code: "US" },
  { name: "Michigan State University", country: "United States", code: "US" },
  { name: "University of Arizona", country: "United States", code: "US" },
  { name: "Arizona State University (ASU)", country: "United States", code: "US" },
  { name: "University of Notre Dame", country: "United States", code: "US" },
  { name: "Rutgers University", country: "United States", code: "US" },
  { name: "University of Rochester", country: "United States", code: "US" },
  { name: "Williams College", country: "United States", code: "US" },
  { name: "Amherst College", country: "United States", code: "US" },
  { name: "Swarthmore College", country: "United States", code: "US" },
  { name: "Wellesley College", country: "United States", code: "US" },

  // ── United Kingdom (Russell Group & Prestigious Colleges) ──
  { name: "University of Oxford", country: "United Kingdom", code: "UK" },
  { name: "University of Cambridge", country: "United Kingdom", code: "UK" },
  { name: "Imperial College London", country: "United Kingdom", code: "UK" },
  { name: "University College London (UCL)", country: "United Kingdom", code: "UK" },
  { name: "London School of Economics and Political Science (LSE)", country: "United Kingdom", code: "UK" },
  { name: "University of Edinburgh", country: "United Kingdom", code: "UK" },
  { name: "King's College London (KCL)", country: "United Kingdom", code: "UK" },
  { name: "University of Manchester", country: "United Kingdom", code: "UK" },
  { name: "University of Bristol", country: "United Kingdom", code: "UK" },
  { name: "University of Warwick", country: "United Kingdom", code: "UK" },
  { name: "University of Glasgow", country: "United Kingdom", code: "UK" },
  { name: "University of Southampton", country: "United Kingdom", code: "UK" },
  { name: "Durham University", country: "United Kingdom", code: "UK" },
  { name: "University of Birmingham", country: "United Kingdom", code: "UK" },
  { name: "University of St Andrews", country: "United Kingdom", code: "UK" },
  { name: "University of Leeds", country: "United Kingdom", code: "UK" },
  { name: "University of Sheffield", country: "United Kingdom", code: "UK" },
  { name: "University of Nottingham", country: "United Kingdom", code: "UK" },
  { name: "Queen Mary University of London", country: "United Kingdom", code: "UK" },
  { name: "Newcastle University", country: "United Kingdom", code: "UK" },
  { name: "University of Exeter", country: "United Kingdom", code: "UK" },
  { name: "University of York", country: "United Kingdom", code: "UK" },
  { name: "University of Liverpool", country: "United Kingdom", code: "UK" },
  { name: "Cardiff University", country: "United Kingdom", code: "UK" },
  { name: "Queen's University Belfast", country: "United Kingdom", code: "UK" },
  { name: "University of Aberdeen", country: "United Kingdom", code: "UK" },
  { name: "University of Bath", country: "United Kingdom", code: "UK" },
  { name: "Lancaster University", country: "United Kingdom", code: "UK" },
  { name: "University of Sussex", country: "United Kingdom", code: "UK" },
  { name: "Loughborough University", country: "United Kingdom", code: "UK" },

  // ── Canada ──
  { name: "University of Toronto", country: "Canada", code: "CA" },
  { name: "McGill University", country: "Canada", code: "CA" },
  { name: "University of British Columbia (UBC)", country: "Canada", code: "CA" },
  { name: "University of Alberta", country: "Canada", code: "CA" },
  { name: "University of Waterloo", country: "Canada", code: "CA" },
  { name: "Western University", country: "Canada", code: "CA" },
  { name: "Université de Montréal", country: "Canada", code: "CA" },
  { name: "McMaster University", country: "Canada", code: "CA" },
  { name: "Queen's University", country: "Canada", code: "CA" },
  { name: "University of Calgary", country: "Canada", code: "CA" },
  { name: "University of Ottawa", country: "Canada", code: "CA" },
  { name: "Simon Fraser University (SFU)", country: "Canada", code: "CA" },

  // ── Continental Europe (Switzerland, Germany, Netherlands, France, etc.) ──
  { name: "ETH Zurich", country: "Switzerland", code: "CH" },
  { name: "EPFL (École Polytechnique Fédérale de Lausanne)", country: "Switzerland", code: "CH" },
  { name: "University of Zurich", country: "Switzerland", code: "CH" },
  { name: "University of Geneva", country: "Switzerland", code: "CH" },
  { name: "Technical University of Munich (TUM)", country: "Germany", code: "DE" },
  { name: "Ludwig Maximilian University of Munich (LMU)", country: "Germany", code: "DE" },
  { name: "Heidelberg University", country: "Germany", code: "DE" },
  { name: "Humboldt University of Berlin", country: "Germany", code: "DE" },
  { name: "Free University of Berlin", country: "Germany", code: "DE" },
  { name: "RWTH Aachen University", country: "Germany", code: "DE" },
  { name: "Karlsruhe Institute of Technology (KIT)", country: "Germany", code: "DE" },
  { name: "TU Berlin", country: "Germany", code: "DE" },
  { name: "University of Bonn", country: "Germany", code: "DE" },
  { name: "University of Amsterdam", country: "Netherlands", code: "NL" },
  { name: "Delft University of Technology (TU Delft)", country: "Netherlands", code: "NL" },
  { name: "Utrecht University", country: "Netherlands", code: "NL" },
  { name: "Erasmus University Rotterdam", country: "Netherlands", code: "NL" },
  { name: "Leiden University", country: "Netherlands", code: "NL" },
  { name: "Eindhoven University of Technology (TU/e)", country: "Netherlands", code: "NL" },
  { name: "University of Groningen", country: "Netherlands", code: "NL" },
  { name: "KU Leuven", country: "Belgium", code: "BE" },
  { name: "Ghent University", country: "Belgium", code: "BE" },
  { name: "Institut Polytechnique de Paris", country: "France", code: "FR" },
  { name: "PSL Research University", country: "France", code: "FR" },
  { name: "Sorbonne University", country: "France", code: "FR" },
  { name: "Sciences Po", country: "France", code: "FR" },
  { name: "University of Paris-Saclay", country: "France", code: "FR" },
  { name: "HEC Paris", country: "France", code: "FR" },
  { name: "INSEAD", country: "France", code: "FR" },
  { name: "Karolinska Institute", country: "Sweden", code: "SE" },
  { name: "Lund University", country: "Sweden", code: "SE" },
  { name: "Uppsala University", country: "Sweden", code: "SE" },
  { name: "KTH Royal Institute of Technology", country: "Sweden", code: "SE" },
  { name: "University of Copenhagen", country: "Denmark", code: "DK" },
  { name: "Aarhus University", country: "Denmark", code: "DK" },
  { name: "University of Helsinki", country: "Finland", code: "FI" },
  { name: "Aalto University", country: "Finland", code: "FI" },
  { name: "University of Oslo", country: "Norway", code: "NO" },
  { name: "Politecnico di Milano", country: "Italy", code: "IT" },
  { name: "Sapienza University of Rome", country: "Italy", code: "IT" },
  { name: "University of Bologna", country: "Italy", code: "IT" },
  { name: "Bocconi University", country: "Italy", code: "IT" },
  { name: "University of Barcelona", country: "Spain", code: "ES" },
  { name: "Autonomous University of Barcelona (UAB)", country: "Spain", code: "ES" },
  { name: "Complutense University of Madrid", country: "Spain", code: "ES" },
  { name: "IE University", country: "Spain", code: "ES" },
  { name: "Trinity College Dublin", country: "Ireland", code: "IE" },
  { name: "University College Dublin (UCD)", country: "Ireland", code: "IE" },
  { name: "University of Vienna", country: "Austria", code: "AT" },

  // ── Asia, Australia & New Zealand ──
  { name: "National University of Singapore (NUS)", country: "Singapore", code: "SG" },
  { name: "Nanyang Technological University (NTU)", country: "Singapore", code: "SG" },
  { name: "Tsinghua University", country: "China", code: "CN" },
  { name: "Peking University", country: "China", code: "CN" },
  { name: "Fudan University", country: "China", code: "CN" },
  { name: "Shanghai Jiao Tong University", country: "China", code: "CN" },
  { name: "Zhejiang University", country: "China", code: "CN" },
  { name: "The University of Tokyo", country: "Japan", code: "JP" },
  { name: "Kyoto University", country: "Japan", code: "JP" },
  { name: "Osaka University", country: "Japan", code: "JP" },
  { name: "Tokyo Institute of Technology", country: "Japan", code: "JP" },
  { name: "University of Hong Kong (HKU)", country: "Hong Kong", code: "HK" },
  { name: "The Hong Kong University of Science and Technology (HKUST)", country: "Hong Kong", code: "HK" },
  { name: "The Chinese University of Hong Kong (CUHK)", country: "Hong Kong", code: "HK" },
  { name: "Seoul National University (SNU)", country: "South Korea", code: "KR" },
  { name: "KAIST", country: "South Korea", code: "KR" },
  { name: "Yonsei University", country: "South Korea", code: "KR" },
  { name: "Korea University", country: "South Korea", code: "KR" },
  { name: "University of Melbourne", country: "Australia", code: "AU" },
  { name: "The University of Sydney", country: "Australia", code: "AU" },
  { name: "The Australian National University (ANU)", country: "Australia", code: "AU" },
  { name: "The University of New South Wales (UNSW Sydney)", country: "Australia", code: "AU" },
  { name: "The University of Queensland (UQ)", country: "Australia", code: "AU" },
  { name: "Monash University", country: "Australia", code: "AU" },
  { name: "The University of Western Australia (UWA)", country: "Australia", code: "AU" },
  { name: "University of Auckland", country: "New Zealand", code: "NZ" },

  // ── Regional Leaders (Azerbaijan, Turkey, Middle East, Georgia) ──
  { name: "ADA University", country: "Azerbaijan", code: "AZ" },
  { name: "Baku Higher Oil School (BHOS)", country: "Azerbaijan", code: "AZ" },
  { name: "French-Azerbaijani University (UFAZ)", country: "Azerbaijan", code: "AZ" },
  { name: "Baku State University (BSU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan State University of Economics (UNEC)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan State Oil and Industry University (ASOIU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan Technical University (AzTU)", country: "Azerbaijan", code: "AZ" },
  { name: "Khazar University", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan Medical University (AMU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan University of Languages (ADU)", country: "Azerbaijan", code: "AZ" },
  { name: "Western Caspian University", country: "Azerbaijan", code: "AZ" },
  { name: "Nakhchivan State University", country: "Azerbaijan", code: "AZ" },
  { name: "Ganja State University", country: "Azerbaijan", code: "AZ" },
  { name: "Koç University", country: "Turkey", code: "TR" },
  { name: "Sabancı University", country: "Turkey", code: "TR" },
  { name: "Middle East Technical University (METU)", country: "Turkey", code: "TR" },
  { name: "Boğaziçi University", country: "Turkey", code: "TR" },
  { name: "Bilkent University", country: "Turkey", code: "TR" },
  { name: "Istanbul Technical University (ITU)", country: "Turkey", code: "TR" },
  { name: "Hacettepe University", country: "Turkey", code: "TR" },
  { name: "Istanbul University", country: "Turkey", code: "TR" },
  { name: "Ankara University", country: "Turkey", code: "TR" },
  { name: "Yıldız Technical University (YTU)", country: "Turkey", code: "TR" },
  { name: "Ege University", country: "Turkey", code: "TR" },
  { name: "Dokuz Eylül University", country: "Turkey", code: "TR" },
  { name: "Gazi University", country: "Turkey", code: "TR" },
  { name: "NYU Abu Dhabi", country: "United Arab Emirates", code: "AE" },
  { name: "Khalifa University", country: "United Arab Emirates", code: "AE" },
  { name: "American University of Sharjah", country: "United Arab Emirates", code: "AE" },
  { name: "King Saud University", country: "Saudi Arabia", code: "SA" },
  { name: "King Fahd University of Petroleum & Minerals (KFUPM)", country: "Saudi Arabia", code: "SA" },
  { name: "Qatar University", country: "Qatar", code: "QA" },
  { name: "American University of Beirut (AUB)", country: "Lebanon", code: "LB" },
  { name: "Tbilisi State University", country: "Georgia", code: "GE" },
  { name: "Ilia State University", country: "Georgia", code: "GE" }
]

// ── Specific Signature University Programs ──
const SIGNATURE_UNIVERSITY_MAP = {
  "Massachusetts Institute of Technology (MIT)": [
    { name: "Computer Science and Engineering (Course 6-3)", faculty: "EECS Department" },
    { name: "Artificial Intelligence & Decision Making (Course 6-4)", faculty: "EECS Department" },
    { name: "Electrical Science & Engineering (Course 6-1)", faculty: "EECS Department" },
    { name: "Mechanical Engineering (Course 2)", faculty: "School of Engineering" },
    { name: "Management Science & Finance (Course 15 / Sloan)", faculty: "Sloan School of Management" },
    { name: "Aerospace Engineering (Course 16)", faculty: "School of Engineering" },
    { name: "Mathematics (Course 18)", faculty: "School of Science" },
    { name: "Physics (Course 8)", faculty: "School of Science" },
    { name: "Chemical Engineering (Course 10)", faculty: "School of Engineering" },
    { name: "Biological Engineering (Course 20)", faculty: "School of Engineering" }
  ],
  "Harvard University": [
    { name: "Computer Science", faculty: "Harvard John A. Paulson SEAS" },
    { name: "Economics", faculty: "Faculty of Arts and Sciences" },
    { name: "Applied Mathematics", faculty: "Harvard John A. Paulson SEAS" },
    { name: "Government (Political Science)", faculty: "Faculty of Arts and Sciences" },
    { name: "Social Studies", faculty: "Faculty of Arts and Sciences" },
    { name: "Molecular & Cellular Biology", faculty: "Life Sciences" },
    { name: "Neuroscience", faculty: "Life Sciences" },
    { name: "Statistics", faculty: "Sciences" },
    { name: "Psychology", faculty: "Social Sciences" },
    { name: "History & Literature", faculty: "Arts & Humanities" }
  ],
  "Stanford University": [
    { name: "Computer Science", faculty: "School of Engineering" },
    { name: "Management Science & Engineering (MS&E)", faculty: "School of Engineering" },
    { name: "Electrical Engineering", faculty: "School of Engineering" },
    { name: "Mechanical Engineering", faculty: "School of Engineering" },
    { name: "Economics", faculty: "School of Humanities and Sciences" },
    { name: "Symbolic Systems", faculty: "Interdisciplinary" },
    { name: "Bioengineering", faculty: "School of Engineering / Medicine" },
    { name: "Data Science", faculty: "School of Humanities and Sciences" },
    { name: "International Relations", faculty: "School of Humanities and Sciences" }
  ],
  "University of Oxford": [
    { name: "Philosophy, Politics and Economics (PPE)", faculty: "Social Sciences Division" },
    { name: "Computer Science", faculty: "Mathematical, Physical and Life Sciences" },
    { name: "Mathematics and Computer Science", faculty: "Mathematical Sciences" },
    { name: "Engineering Science", faculty: "Department of Engineering Science" },
    { name: "Jurisprudence (Law)", faculty: "Faculty of Law" },
    { name: "Medicine", faculty: "Medical Sciences Division" },
    { name: "Economics and Management", faculty: "Saïd Business School" },
    { name: "Physics", faculty: "Mathematical, Physical and Life Sciences" },
    { name: "Biochemistry", faculty: "Medical Sciences Division" }
  ],
  "University of Cambridge": [
    { name: "Computer Science Tripos", faculty: "Faculty of Computer Science" },
    { name: "Engineering Tripos", faculty: "Department of Engineering" },
    { name: "Natural Sciences Tripos", faculty: "School of Physical Sciences" },
    { name: "Economics Tripos", faculty: "Faculty of Economics" },
    { name: "Law Tripos", faculty: "Faculty of Law" },
    { name: "Medicine Tripos", faculty: "School of Clinical Medicine" },
    { name: "Mathematics Tripos", faculty: "Faculty of Mathematics" },
    { name: "Human, Social, and Political Sciences (HSPS)", faculty: "Faculty of HSPS" }
  ],
  "Imperial College London": [
    { name: "Computing (Software Engineering)", faculty: "Department of Computing" },
    { name: "Computing (Artificial Intelligence & Machine Learning)", faculty: "Department of Computing" },
    { name: "Electrical & Electronic Engineering", faculty: "Department of EEE" },
    { name: "Mechanical Engineering", faculty: "Department of Mechanical Engineering" },
    { name: "Biomedical Engineering", faculty: "Department of Bioengineering" },
    { name: "Chemical Engineering", faculty: "Department of Chemical Engineering" },
    { name: "Civil Engineering", faculty: "Department of Civil Engineering" },
    { name: "Medicine (MBBS)", faculty: "Faculty of Medicine" }
  ],
  "London School of Economics and Political Science (LSE)": [
    { name: "Economics", faculty: "Department of Economics" },
    { name: "Finance", faculty: "Department of Finance" },
    { name: "Accounting and Finance", faculty: "Department of Accounting" },
    { name: "International Relations", faculty: "Department of International Relations" },
    { name: "Politics and Economics", faculty: "Department of Government" },
    { name: "Law (LLB)", faculty: "LSE Law School" },
    { name: "Data Science", faculty: "Department of Statistics" },
    { name: "Management", faculty: "Department of Management" }
  ],
  "ETH Zurich": [
    { name: "Computer Science", faculty: "Department of Computer Science (D-INFK)" },
    { name: "Data Science", faculty: "D-INFK / D-MATH" },
    { name: "Mechanical Engineering", faculty: "Department of Mechanical Engineering (D-MAVT)" },
    { name: "Electrical Engineering & Information Technology", faculty: "D-ITET" },
    { name: "Civil Engineering", faculty: "Department of Civil Engineering (D-BAUG)" },
    { name: "Physics", faculty: "Department of Physics (D-PHYS)" },
    { name: "Architecture", faculty: "Department of Architecture (D-ARCH)" }
  ],
  "Technical University of Munich (TUM)": [
    { name: "Informatics (Computer Science)", faculty: "TUM School of CIT" },
    { name: "Information Engineering", faculty: "TUM School of CIT" },
    { name: "Management and Technology (TUM-BWL)", faculty: "TUM School of Management" },
    { name: "Mechanical Engineering", faculty: "TUM School of Engineering and Design" },
    { name: "Electrical Engineering & Information Technology", faculty: "TUM School of CIT" },
    { name: "Robotics, Cognition, Intelligence", faculty: "TUM School of CIT" }
  ],
  "University of Toronto": [
    { name: "Computer Science", faculty: "Faculty of Arts & Science" },
    { name: "Rotman Commerce (Finance & Economics)", faculty: "Rotman School of Management" },
    { name: "Engineering Science", faculty: "Faculty of Applied Science & Engineering" },
    { name: "TrackOne General Engineering", faculty: "Faculty of Applied Science & Engineering" },
    { name: "Data Science Specialist", faculty: "Faculty of Arts & Science" },
    { name: "Life Sciences & Neuroscience", faculty: "Faculty of Arts & Science" }
  ],
  "University of Waterloo": [
    { name: "Computer Science (Co-op)", faculty: "David R. Cheriton School of Computer Science" },
    { name: "Software Engineering (Co-op)", faculty: "Faculty of Engineering" },
    { name: "Computer Engineering", faculty: "Faculty of Engineering" },
    { name: "Mathematics / Financial Analysis & Risk Management", faculty: "Faculty of Mathematics" },
    { name: "Mechanical Engineering", faculty: "Faculty of Engineering" }
  ],
  "ADA University": [
    { name: "Computer Science", faculty: "School of IT and Engineering (SITE)" },
    { name: "Computer Engineering", faculty: "School of IT and Engineering (SITE)" },
    { name: "Information Technology", faculty: "School of IT and Engineering (SITE)" },
    { name: "Electrical & Electronics Engineering", faculty: "School of IT and Engineering (SITE)" },
    { name: "Business Administration (BBA)", faculty: "School of Business" },
    { name: "Economics", faculty: "School of Business" },
    { name: "Finance", faculty: "School of Business" },
    { name: "International Studies", faculty: "School of Public & International Affairs (SPIA)" },
    { name: "Public Affairs", faculty: "School of Public & International Affairs (SPIA)" },
    { name: "Law (LLB)", faculty: "School of Law" },
    { name: "Architecture", faculty: "School of Design & Architecture" },
    { name: "Interior Design", faculty: "School of Design & Architecture" },
    { name: "Agricultural Sciences", faculty: "School of Agricultural & Food Sciences" }
  ],
  "Baku Higher Oil School (BHOS)": [
    { name: "Petroleum Engineering", faculty: "School of Engineering" },
    { name: "Chemical Engineering", faculty: "School of Engineering" },
    { name: "Process Automation Engineering", faculty: "School of Engineering" },
    { name: "Information Security", faculty: "School of IT and CS" },
    { name: "Computer Engineering", faculty: "School of IT and CS" },
    { name: "Business Administration", faculty: "School of Business" }
  ],
  "French-Azerbaijani University (UFAZ)": [
    { name: "Computer Science", faculty: "Université de Strasbourg Dual Degree" },
    { name: "Chemical Engineering", faculty: "Université de Strasbourg Dual Degree" },
    { name: "Petroleum & Mining Engineering", faculty: "Université de Rennes 1 Dual Degree" },
    { name: "Geophysics and Earth Sciences", faculty: "Université de Strasbourg Dual Degree" }
  ],
  "Baku State University (BSU)": [
    { name: "Applied Mathematics and Cybernetics", faculty: "Faculty of Applied Mathematics" },
    { name: "Computer Science & IT", faculty: "Faculty of Mechanics & Mathematics" },
    { name: "Law / Jurisprudence", faculty: "Faculty of Law" },
    { name: "International Relations and Economics", faculty: "Faculty of International Relations" },
    { name: "Physics & Nanotechnology", faculty: "Faculty of Physics" },
    { name: "Chemistry & Nanomaterials", faculty: "Faculty of Chemistry" },
    { name: "Biology & Genetics", faculty: "Faculty of Biology" },
    { name: "Journalism & Media", faculty: "Faculty of Journalism" },
    { name: "Translation Studies (English)", faculty: "Faculty of Philology" }
  ],
  "Azerbaijan State University of Economics (UNEC)": [
    { name: "Finance", faculty: "International School of Economics (ISE)" },
    { name: "Accounting and Auditing", faculty: "International School of Economics (ISE)" },
    { name: "Economics", faculty: "International School of Economics (ISE)" },
    { name: "Business Administration", faculty: "UNEC Business School" },
    { name: "Marketing", faculty: "Faculty of Marketing & Management" },
    { name: "World Economy", faculty: "Faculty of Economics" },
    { name: "Digital Economy & Information Technologies", faculty: "Faculty of Digital Economy" }
  ],
  "Azerbaijan State Oil and Industry University (ASOIU)": [
    { name: "Petroleum Engineering", faculty: "Oil & Gas Mining Faculty" },
    { name: "Computer Engineering", faculty: "Information Technologies & Control" },
    { name: "Information Technologies & Systems", faculty: "Information Technologies & Control" },
    { name: "Chemical Technology & Engineering", faculty: "Chemical Technology" },
    { name: "Mechatronics and Robotics", faculty: "Electromechanics & Automation" },
    { name: "Geology and Mining Engineering", faculty: "Geological Exploration" }
  ],
  "Azerbaijan Medical University (AMU)": [
    { name: "General Medicine (MD)", faculty: "Faculty of General Medicine" },
    { name: "Dentistry (Stomatology)", faculty: "Faculty of Dentistry" },
    { name: "Pharmacy", faculty: "Faculty of Pharmacy" },
    { name: "Public Health", faculty: "Faculty of Public Health" },
    { name: "Military Medicine", faculty: "Military Medical Faculty" }
  ],
  "Azerbaijan Technical University (AzTU)": [
    { name: "Information Security", faculty: "Faculty of IT & Telecommunications" },
    { name: "Software Engineering", faculty: "Faculty of IT & Telecommunications" },
    { name: "Computer Engineering", faculty: "Faculty of IT & Telecommunications" },
    { name: "Mechanical Engineering", faculty: "Faculty of Mechanical Engineering" },
    { name: "Automotive & Transport Engineering", faculty: "Faculty of Transport & Logistics" },
    { name: "Telecommunications & Radio Engineering", faculty: "Faculty of Radio Engineering" }
  ],
  "Azerbaijan University of Languages (ADU)": [
    { name: "Translation (English)", faculty: "Faculty of Translation" },
    { name: "Translation (German / French)", faculty: "Faculty of Translation" },
    { name: "English Language Teaching & Pedagogy", faculty: "Faculty of Education" },
    { name: "International Relations & Regional Studies", faculty: "Faculty of International Relations" }
  ],
  "Khazar University": [
    { name: "Computer Science", faculty: "School of Science and Engineering" },
    { name: "Computer Engineering", faculty: "School of Science and Engineering" },
    { name: "Petroleum and Gas Engineering", faculty: "School of Science and Engineering" },
    { name: "Business Management (BBA)", faculty: "School of Economics and Management" },
    { name: "Finance and Economics", faculty: "School of Economics and Management" },
    { name: "International Relations", faculty: "School of Humanities and Social Sciences" }
  ],
  "Koç University": [
    { name: "Computer Engineering", faculty: "College of Engineering" },
    { name: "Electrical & Electronics Engineering", faculty: "College of Engineering" },
    { name: "Industrial Engineering", faculty: "College of Engineering" },
    { name: "Mechanical Engineering", faculty: "College of Engineering" },
    { name: "Business Administration", faculty: "College of Administrative Sciences and Economics" },
    { name: "Economics", faculty: "College of Administrative Sciences and Economics" },
    { name: "International Relations", faculty: "College of Administrative Sciences and Economics" },
    { name: "Law (LLB)", faculty: "Law School" },
    { name: "Medicine (MD)", faculty: "School of Medicine" },
    { name: "Psychology", faculty: "College of Social Sciences and Humanities" }
  ],
  "Sabancı University": [
    { name: "Computer Science & Engineering", faculty: "Faculty of Engineering and Natural Sciences" },
    { name: "Data Science and Analytics", faculty: "Faculty of Engineering and Natural Sciences" },
    { name: "Industrial Engineering", faculty: "Faculty of Engineering and Natural Sciences" },
    { name: "Mechatronics Engineering", faculty: "Faculty of Engineering and Natural Sciences" },
    { name: "Management", faculty: "Sabancı Business School" },
    { name: "Economics", faculty: "Faculty of Arts and Social Sciences" },
    { name: "Political Science & International Relations", faculty: "Faculty of Arts and Social Sciences" }
  ],
  "Middle East Technical University (METU)": [
    { name: "Computer Engineering", faculty: "Faculty of Engineering" },
    { name: "Electrical and Electronics Engineering", faculty: "Faculty of Engineering" },
    { name: "Mechanical Engineering", faculty: "Faculty of Engineering" },
    { name: "Civil Engineering", faculty: "Faculty of Engineering" },
    { name: "Aerospace Engineering", faculty: "Faculty of Engineering" },
    { name: "Industrial Engineering", faculty: "Faculty of Engineering" },
    { name: "Business Administration", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "Economics", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "International Relations", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "Architecture", faculty: "Faculty of Architecture" }
  ],
  "Boğaziçi University": [
    { name: "Computer Engineering", faculty: "Faculty of Engineering" },
    { name: "Electrical and Electronics Engineering", faculty: "Faculty of Engineering" },
    { name: "Industrial Engineering", faculty: "Faculty of Engineering" },
    { name: "Mechanical Engineering", faculty: "Faculty of Engineering" },
    { name: "Management", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "Economics", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "Political Science & International Relations", faculty: "Faculty of Economics and Administrative Sciences" },
    { name: "Psychology", faculty: "Faculty of Arts and Sciences" }
  ],
  "Bilkent University": [
    { name: "Computer Engineering", faculty: "Faculty of Engineering" },
    { name: "Electrical and Electronics Engineering", faculty: "Faculty of Engineering" },
    { name: "Industrial Engineering", faculty: "Faculty of Engineering" },
    { name: "Mechanical Engineering", faculty: "Faculty of Engineering" },
    { name: "Business Administration", faculty: "Faculty of Business Administration" },
    { name: "Economics", faculty: "Faculty of Economics, Administrative, and Social Sciences" },
    { name: "International Relations", faculty: "Faculty of Economics, Administrative, and Social Sciences" },
    { name: "Law (LLB)", faculty: "Faculty of Law" },
    { name: "Architecture", faculty: "Faculty of Art, Design, and Architecture" }
  ],
  "Istanbul Technical University (ITU)": [
    { name: "Computer Engineering", faculty: "Faculty of Computer and Informatics" },
    { name: "Artificial Intelligence & Data Engineering", faculty: "Faculty of Computer and Informatics" },
    { name: "Electronics & Communication Engineering", faculty: "Faculty of Electrical and Electronics" },
    { name: "Mechanical Engineering", faculty: "Faculty of Mechanical Engineering" },
    { name: "Control and Automation Engineering", faculty: "Faculty of Electrical and Electronics" },
    { name: "Aeronautical Engineering", faculty: "Faculty of Aeronautics and Astronautics" },
    { name: "Naval Architecture and Ocean Engineering", faculty: "Faculty of Naval Architecture" }
  ]
}

// ── Smart Dynamic Degree Programs Engine for ALL Universities ──
function getUniversityCurriculum(uniName) {
  if (!uniName) return []

  // 1. Direct Signature mapping
  if (SIGNATURE_UNIVERSITY_MAP[uniName]) {
    return SIGNATURE_UNIVERSITY_MAP[uniName]
  }

  // 2. Specific Medical Universities
  if (uniName.includes('Medical') || uniName.includes('Karolinska')) {
    return [
      { name: "General Medicine (MD / MBBS)", faculty: "Faculty of Medicine" },
      { name: "Dental Surgery (BDS / DDS)", faculty: "Faculty of Dentistry" },
      { name: "Pharmacy & Pharmacology", faculty: "Faculty of Pharmacy" },
      { name: "Public Health & Global Health", faculty: "Faculty of Public Health" },
      { name: "Nursing & Clinical Leadership", faculty: "Faculty of Nursing" },
      { name: "Biomedical Sciences & Genetics", faculty: "Faculty of Biomedical Sciences" },
      { name: "Physical Therapy & Rehabilitation", faculty: "Health Sciences" },
      { name: "Health Informatics & Biostatistics", faculty: "Health Sciences" }
    ]
  }

  // 3. Specific Business / Economics Specialized Schools
  if (uniName.includes('Bocconi') || uniName.includes('HEC Paris') || uniName.includes('INSEAD') || uniName.includes('Economics')) {
    return [
      { name: "Economics", faculty: "Department of Economics" },
      { name: "Finance & Financial Markets", faculty: "Department of Finance" },
      { name: "Accounting and Financial Management", faculty: "Department of Accounting" },
      { name: "International Business & Strategy", faculty: "School of Management" },
      { name: "Business Administration (BBA)", faculty: "School of Management" },
      { name: "Marketing Management", faculty: "Department of Marketing" },
      { name: "Data Science & Business Analytics", faculty: "Department of Decision Sciences" },
      { name: "Econometrics & Quantitative Finance", faculty: "Department of Economics" },
      { name: "International Politics and Government", faculty: "Department of Policy Analysis" }
    ]
  }

  // 4. Institutes of Technology & Engineering Specialized Universities
  if (
    uniName.includes('Technology') || uniName.includes('Polytechnic') ||
    uniName.includes('Caltech') || uniName.includes('Georgia Tech') ||
    uniName.includes('Purdue') || uniName.includes('EPFL') || uniName.includes('KAIST')
  ) {
    return [
      { name: "Computer Science & Engineering", faculty: "School of Computing" },
      { name: "Artificial Intelligence & Robotics", faculty: "School of Computing" },
      { name: "Data Science & Machine Learning", faculty: "School of Computing" },
      { name: "Electrical & Computer Engineering", faculty: "School of Electrical Engineering" },
      { name: "Mechanical Engineering", faculty: "School of Mechanical Engineering" },
      { name: "Aerospace & Astronautical Engineering", faculty: "School of Engineering" },
      { name: "Civil & Environmental Engineering", faculty: "School of Civil Engineering" },
      { name: "Chemical & Biomolecular Engineering", faculty: "School of Chemical Engineering" },
      { name: "Materials Science & Nanotechnology", faculty: "School of Engineering" },
      { name: "Industrial & Operations Engineering", faculty: "School of Engineering" },
      { name: "Applied Physics & Quantum Engineering", faculty: "School of Physical Sciences" },
      { name: "Applied Mathematics & Statistics", faculty: "School of Mathematics" }
    ]
  }

  // 5. Comprehensive Top World Universities (Branded with famous colleges & faculties)
  let bizFaculty = "School of Business & Management"
  let engFaculty = "College of Engineering & Applied Sciences"
  let medFaculty = "School of Medicine & Health Sciences"
  let lawFaculty = "Faculty of Law"

  if (uniName.includes('Pennsylvania')) {
    bizFaculty = "The Wharton School"
    engFaculty = "Penn Engineering"
    medFaculty = "Perelman School of Medicine"
  } else if (uniName.includes('New York University')) {
    bizFaculty = "Stern School of Business"
    engFaculty = "Tandon School of Engineering"
  } else if (uniName.includes('Berkeley')) {
    bizFaculty = "Haas School of Business"
    engFaculty = "College of Engineering (EECS)"
  } else if (uniName.includes('Michigan')) {
    bizFaculty = "Stephen M. Ross School of Business"
    engFaculty = "Michigan Engineering"
  } else if (uniName.includes('Carnegie Mellon')) {
    bizFaculty = "Tepper School of Business"
    engFaculty = "College of Engineering"
  } else if (uniName.includes('British Columbia')) {
    bizFaculty = "Sauder School of Business"
  } else if (uniName.includes('Warwick')) {
    bizFaculty = "Warwick Business School (WBS)"
  } else if (uniName.includes('Manchester')) {
    bizFaculty = "Alliance Manchester Business School"
  } else if (uniName.includes('King\'s College')) {
    bizFaculty = "King\'s Business School"
    lawFaculty = "The Dickson Poon School of Law"
  } else if (uniName.includes('Chicago')) {
    bizFaculty = "Booth School of Business / Economics"
  } else if (uniName.includes('Columbia')) {
    bizFaculty = "Columbia Business / Financial Economics"
    engFaculty = "Fu Foundation SEAS"
  } else if (uniName.includes('Northwestern')) {
    bizFaculty = "Kellogg School / Economics"
    engFaculty = "McCormick School of Engineering"
  } else if (uniName.includes('Duke')) {
    bizFaculty = "Fuqua / Economics"
    engFaculty = "Pratt School of Engineering"
  } else if (uniName.includes('Johns Hopkins')) {
    engFaculty = "Whiting School of Engineering"
    medFaculty = "Johns Hopkins School of Medicine"
  } else if (uniName.includes('Illinois')) {
    bizFaculty = "Gies College of Business"
    engFaculty = "The Grainger College of Engineering"
  } else if (uniName.includes('Austin')) {
    bizFaculty = "McCombs School of Business"
    engFaculty = "Cockrell School of Engineering"
  } else if (uniName.includes('Washington')) {
    bizFaculty = "Foster School of Business"
    engFaculty = "Paul G. Allen School of CSE"
  } else if (uniName.includes('Cornell')) {
    bizFaculty = "Dyson / Johnson College of Business"
    engFaculty = "Cornell College of Engineering & Bowers CIS"
  } else if (uniName.includes('UCLA')) {
    engFaculty = "Samueli School of Engineering"
  } else if (uniName.includes('USC')) {
    bizFaculty = "Marshall School of Business"
    engFaculty = "Viterbi School of Engineering"
  }

  return [
    { name: "Computer Science", faculty: engFaculty },
    { name: "Software Engineering", faculty: engFaculty },
    { name: "Data Science & Artificial Intelligence", faculty: engFaculty },
    { name: "Electrical & Computer Engineering", faculty: engFaculty },
    { name: "Mechanical Engineering", faculty: engFaculty },
    { name: "Civil & Environmental Engineering", faculty: engFaculty },
    { name: "Chemical & Biomolecular Engineering", faculty: engFaculty },
    { name: "Biomedical Engineering", faculty: engFaculty },
    { name: "Finance & Financial Economics", faculty: bizFaculty },
    { name: "Business Administration & Management", faculty: bizFaculty },
    { name: "Economics", faculty: "Faculty of Social Sciences" },
    { name: "Accounting & Auditing", faculty: bizFaculty },
    { name: "Marketing & Strategic Management", faculty: bizFaculty },
    { name: "International Relations & Global Affairs", faculty: "School of Public & International Affairs" },
    { name: "Political Science & Government", faculty: "Faculty of Social Sciences" },
    { name: "Law / Jurisprudence (LLB / Pre-Law)", faculty: lawFaculty },
    { name: "Pre-Medicine / General Medicine (MD)", faculty: medFaculty },
    { name: "Psychology & Cognitive Science", faculty: "Faculty of Social Sciences" },
    { name: "Mathematics & Applied Mathematics", faculty: "Faculty of Natural Sciences" },
    { name: "Physics & Astrophysics", faculty: "Faculty of Natural Sciences" },
    { name: "Chemistry & Chemical Biology", faculty: "Faculty of Natural Sciences" },
    { name: "Molecular, Cellular & Developmental Biology", faculty: "Faculty of Life Sciences" },
    { name: "Neuroscience", faculty: "Faculty of Life Sciences" },
    { name: "Architecture & Urban Planning", faculty: "School of Architecture & Design" },
    { name: "Journalism & Media Communications", faculty: "School of Communication" },
    { name: "English Literature & Creative Writing", faculty: "Faculty of Arts & Humanities" }
  ]
}

// Professional Country Phone Calling Codes (Clean, no duplicate strings, standard worldwide labels)
const COUNTRY_DIAL_CODES = [
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+994", label: "Azerbaijan (+994)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
  { code: "+48", label: "Poland (+48)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+995", label: "Georgia (+995)" },
  { code: "+7", label: "Kazakhstan / Region (+7)" }
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, loading, signOut } = useAuth()

  // Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+994')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')

  // Autocomplete UI dropdown controls
  const [uniQuery, setUniQuery] = useState('')
  const [showUniDropdown, setShowUniDropdown] = useState(false)
  const [majorQuery, setMajorQuery] = useState('')
  const [showMajorDropdown, setShowMajorDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const uniDropdownRef = useRef(null)
  const majorDropdownRef = useRef(null)
  const majorInputRef = useRef(null)

  // Populate existing data if available
  useEffect(() => {
    if (profile) {
      if (profile.full_name) {
        const parts = profile.full_name.trim().split(/\s+/)
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
      }
      if (profile.phone) {
        const matched = COUNTRY_DIAL_CODES.find(c => profile.phone.startsWith(c.code))
        if (matched) {
          setCountryCode(matched.code)
          setPhoneRaw(profile.phone.slice(matched.code.length).trim())
        } else {
          setPhoneRaw(profile.phone)
        }
      }
      if (profile.university) {
        setUniversity(profile.university)
        setUniQuery(profile.university)
      }
      if (profile.major) {
        setMajor(profile.major)
        setMajorQuery(profile.major)
      }
      if (profile.gender) {
        setGender(profile.gender)
      }
    }
  }, [profile])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (uniDropdownRef.current && !uniDropdownRef.current.contains(e.target)) {
        setShowUniDropdown(false)
      }
      if (majorDropdownRef.current && !majorDropdownRef.current.contains(e.target)) {
        setShowMajorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-detect country code if pasted with a leading +
  function handlePhoneChange(val) {
    const trimmed = val.trim()
    if (trimmed.startsWith('+')) {
      const match = COUNTRY_DIAL_CODES.find(c => trimmed.startsWith(c.code))
      if (match) {
        setCountryCode(match.code)
        setPhoneRaw(trimmed.slice(match.code.length).trim())
        return
      }
    }
    setPhoneRaw(val)
  }

  // Filtered universities with instant search
  const filteredUniversities = useMemo(() => {
    if (!uniQuery.trim()) return TOP_UNIVERSITIES.slice(0, 15)
    const q = uniQuery.toLowerCase().trim()
    return TOP_UNIVERSITIES.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.country.toLowerCase().includes(q) ||
      (u.code && u.code.toLowerCase() === q)
    ).slice(0, 25)
  }, [uniQuery])

  // University-specific program list or dynamic curriculum
  const activeUniversityPrograms = useMemo(() => {
    if (!university) return []
    return getUniversityCurriculum(university)
  }, [university])

  // Filtered majors for selected university
  const filteredMajors = useMemo(() => {
    if (!majorQuery.trim()) return activeUniversityPrograms.slice(0, 25)
    const q = majorQuery.toLowerCase().trim()
    return activeUniversityPrograms.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.faculty.toLowerCase().includes(q)
    ).slice(0, 30)
  }, [majorQuery, activeUniversityPrograms])

  function handleSelectUniversity(name) {
    setUniversity(name)
    setUniQuery(name)
    setShowUniDropdown(false)
    // If university changed, reset major to prompt selecting offered program
    setMajor('')
    setMajorQuery('')
    setTimeout(() => {
      if (majorInputRef.current) {
        majorInputRef.current.focus()
        setShowMajorDropdown(true)
      }
    }, 120)
  }

  function handleSelectMajor(name) {
    setMajor(name)
    setMajorQuery(name)
    setShowMajorDropdown(false)
  }

  function handleClearUniversity() {
    setUniversity('')
    setUniQuery('')
    setMajor('')
    setMajorQuery('')
    setShowUniDropdown(false)
    setShowMajorDropdown(false)
  }

  function handleClearMajor() {
    setMajor('')
    setMajorQuery('')
    setShowMajorDropdown(false)
  }

  function handleUniKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredUniversities.length > 0) {
        handleSelectUniversity(filteredUniversities[0].name)
      } else if (uniQuery.trim()) {
        handleSelectUniversity(uniQuery.trim())
      }
    }
  }

  function handleMajorKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredMajors.length > 0) {
        handleSelectMajor(filteredMajors[0].name)
      } else if (majorQuery.trim()) {
        handleSelectMajor(majorQuery.trim())
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    if (!firstName.trim()) {
      setError('Please enter your first name.')
      return
    }
    if (!lastName.trim()) {
      setError('Please enter your last name.')
      return
    }
    if (!phoneRaw.trim()) {
      setError('Please enter your mobile phone number.')
      return
    }
    if (!university.trim()) {
      setError('Please select or enter your college or university.')
      return
    }
    if (!major.trim()) {
      setError('Please select or enter your intended degree major.')
      return
    }
    if (!gender) {
      setError('Please select your gender.')
      return
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`
    const full_phone = `${countryCode} ${phoneRaw.trim()}`

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name,
      phone: full_phone,
      university: university.trim(),
      major: major.trim(),
      gender,
      is_profile_completed: true,
      updated_at: new Date().toISOString()
    })

    if (upsertError) {
      setSaving(false)
      setError(upsertError.message)
      return
    }

    const { data: refreshedProfile, error: refreshErr } = await refreshProfile()
    setSaving(false)

    if (refreshErr) {
      setError(refreshErr.message)
      return
    }

    if (refreshedProfile?.role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/student', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="complete-profile-page">
        <div className="complete-profile-bg complete-profile-bg--one" />
        <div className="complete-profile-bg complete-profile-bg--two" />
        <div className="complete-profile-shell">
          <div className="complete-profile-card complete-profile-card--loading">
            <p className="complete-profile-loading">Loading your profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="complete-profile-page">
      <div className="complete-profile-bg complete-profile-bg--one" />
      <div className="complete-profile-bg complete-profile-bg--two" />

      <div className="complete-profile-shell">
        <div className="complete-profile-panel">
          {/* Left Brand Pitch */}
          <div className="complete-profile-copy">
            <span className="complete-profile-kicker">AppTrack Onboarding</span>
            <h1>Complete your profile</h1>
            <p>
              Set up your verified student identity, international contact number, and target university program to unlock your application dashboard.
            </p>

            <div className="complete-profile-points">
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Global institutional catalog covering top 500+ world universities.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Curriculum dynamically mapped to official faculties and colleges.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Standard international dialing code support with verified phone formatting.</span>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <form className="complete-profile-card" onSubmit={handleSubmit}>
            <div className="complete-profile-cardhead">
              <div>
                <p className="complete-profile-eyebrow">Student Identity</p>
                <h2>Personal Details</h2>
              </div>
              <button
                type="button"
                className="complete-profile-signout"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>

            <div className="complete-profile-grid">
              {/* 1. First Name */}
              <label className="complete-profile-field">
                <span>First Name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  autoComplete="given-name"
                  required
                />
              </label>

              {/* 2. Last Name */}
              <label className="complete-profile-field">
                <span>Last Name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  autoComplete="family-name"
                  required
                />
              </label>

              {/* 3. Mobile Phone with Clean Country Selector */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Mobile Phone <em className="req-star">*</em></span>
                <div className="phone-input-group">
                  <div className="phone-country-select-wrap">
                    <select
                      className="phone-country-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="tel"
                    className="phone-number-input"
                    value={phoneRaw}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="50 123 45 67"
                    autoComplete="tel-national"
                    required
                  />
                </div>
                <small className="field-hint">Select your dialing code and enter your mobile number.</small>
              </div>

              {/* 4. University Selection with Autocomplete and Custom Fallback */}
              <div className="complete-profile-field complete-profile-field--full" ref={uniDropdownRef}>
                <div className="field-label-row">
                  <span>College / University <em className="req-star">*</em></span>
                  {university && <span className="uni-verified-badge">✓ Selected</span>}
                </div>
                <div className="autocomplete-wrap">
                  <input
                    type="text"
                    value={uniQuery}
                    onChange={(e) => {
                      setUniQuery(e.target.value)
                      setUniversity(e.target.value)
                      setShowUniDropdown(true)
                    }}
                    onFocus={() => setShowUniDropdown(true)}
                    onKeyDown={handleUniKeyDown}
                    placeholder="Search university or enter custom institution..."
                    autoComplete="off"
                    required
                  />
                  {uniQuery && (
                    <button
                      type="button"
                      className="autocomplete-clear-btn"
                      onClick={handleClearUniversity}
                      title="Clear university"
                    >
                      ✕
                    </button>
                  )}
                  {showUniDropdown && (
                    <div className="autocomplete-dropdown">
                      {filteredUniversities.map((u) => (
                        <button
                          key={u.name}
                          type="button"
                          className={`autocomplete-item ${u.name === university ? 'autocomplete-item--active' : ''}`}
                          onClick={() => handleSelectUniversity(u.name)}
                        >
                          <span className="autocomplete-icon">🏛️</span>
                          <div className="autocomplete-text">
                            <strong>{u.name}</strong>
                            <small>{u.country} · Accredited University</small>
                          </div>
                        </button>
                      ))}

                      {/* Custom Fallback item if user is typing any custom institution */}
                      {uniQuery.trim() && (
                        <button
                          type="button"
                          className="autocomplete-item autocomplete-item--custom"
                          onClick={() => handleSelectUniversity(uniQuery.trim())}
                        >
                          <span className="autocomplete-icon">✨</span>
                          <div className="autocomplete-text">
                            <strong>Use "{uniQuery.trim()}"</strong>
                            <small>Click to set as your institution</small>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Major Selection (Tailored specifically to the selected university!) */}
              <div className="complete-profile-field complete-profile-field--full" ref={majorDropdownRef}>
                <div className="field-label-row">
                  <span>Intended Degree Major <em className="req-star">*</em></span>
                  {!university ? (
                    <span className="field-locked-pill">🔒 Select university first</span>
                  ) : (
                    <span className="uni-verified-badge">🏛️ {university.split('(')[0].trim()} Curriculum</span>
                  )}
                </div>
                <div className="autocomplete-wrap">
                  <input
                    ref={majorInputRef}
                    type="text"
                    disabled={!university}
                    value={majorQuery}
                    onChange={(e) => {
                      setMajorQuery(e.target.value)
                      setMajor(e.target.value)
                      setShowMajorDropdown(true)
                    }}
                    onFocus={() => {
                      if (university) setShowMajorDropdown(true)
                    }}
                    onKeyDown={handleMajorKeyDown}
                    placeholder={
                      university
                        ? `Select official program offered at ${university.split('(')[0].trim()}...`
                        : "Select or enter your university first"
                    }
                    autoComplete="off"
                    required
                  />
                  {majorQuery && university && (
                    <button
                      type="button"
                      className="autocomplete-clear-btn"
                      onClick={handleClearMajor}
                      title="Clear major"
                    >
                      ✕
                    </button>
                  )}
                  {showMajorDropdown && university && (
                    <div className="autocomplete-dropdown">
                      {filteredMajors.map((m) => (
                        <button
                          key={m.name}
                          type="button"
                          className={`autocomplete-item ${m.name === major ? 'autocomplete-item--active' : ''}`}
                          onClick={() => handleSelectMajor(m.name)}
                        >
                          <span className="autocomplete-icon">🎓</span>
                          <div className="autocomplete-text">
                            <strong>{m.name}</strong>
                            <small>{m.faculty} · Official Degree Program</small>
                          </div>
                        </button>
                      ))}

                      {/* Custom Major Fallback for joint honors, dual degrees, or specialized majors */}
                      {majorQuery.trim() && (
                        <button
                          type="button"
                          className="autocomplete-item autocomplete-item--custom"
                          onClick={() => handleSelectMajor(majorQuery.trim())}
                        >
                          <span className="autocomplete-icon">✨</span>
                          <div className="autocomplete-text">
                            <strong>Use "{majorQuery.trim()}"</strong>
                            <small>Click to set as your custom degree major</small>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Gender Selection */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Gender <em className="req-star">*</em></span>
                <div className="gender-btn-group">
                  {['Male', 'Female', 'Other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`gender-pill-btn ${gender === g ? 'gender-pill-btn--active' : ''}`}
                      onClick={() => setGender(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? <p className="complete-profile-error">{error}</p> : null}

            <div className="complete-profile-actions">
              <button
                type="submit"
                className="complete-profile-submit"
                disabled={saving || !firstName || !lastName || !phoneRaw || !university || !major || !gender}
              >
                {saving ? 'Saving profile...' : 'Save & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
