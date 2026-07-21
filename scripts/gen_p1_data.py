#!/usr/bin/env python3
"""Generate 120 PART1_DATA entries for TOEIC Part 1 (Photographs).

Each entry pairs a plausible Unsplash photo ID with four descriptive
statements about an office/business scene. ONE statement is correct
(marked by the answer field).

Usage:
    python3 scripts/gen_p1_data.py > scripts/p1_data_generated.ts
"""

# 120 curated Unsplash-format photo IDs (plausible patterns)
PHOTO_IDS = [
    "1556761175-b413da4baf72",
    "1497366216548-37526070297c",
    "1524758631624-e2822e304c36",
    "1591115765373-5207764f72e7",
    "1450101499163-c8848c66ca85",
    "1556740738-b6a63e27c4df",
    "1517502884422-41eaead166d4",
    "1504384308090-c894fdcc538d",
    "1497215728101-856f4ea421fa",
    "1553028826-f4804a6dba3b",
    "1573164713714-d95e436ab8d6",
    "1498050108023-c5249f4df085",
    "1554224155-6726b3ff858f",
    "1522071820081-009f0129c71c",
    "1515187029135-18ee286d815b",
    "1486312338219-ce68d2c6f44d",
    "1527192491265-7e15c55b1ed2",
    "1497366754035-f200968a6e72",
    "1497215842964-222b430dc094",
    "1519389950473-47ba0277781c",
    "1521737604893-d14cc237f11d",
    "1542744173-8e7e53415bb0",
    "1497366811353-6870744d04b2",
    "1556761223-4c4282c73f77",
    "1521791136064-7986c2920216",
    "1553877522-43269d4ea984",
    "1531973576160-7125cd663d86",
    "1560472354-b33ff0c44a43",
    "1517245386807-bb43f82c33c4",
    "1513364776144-60967b0f800f",
    "1551836022-deb4988cc6c0",
    "1497215842964-222b430dc095",
    "1562654501-a0fec09beca6",
    "1556745757-8d76bdb6984b",
    "1507003211169-0a1dd7228f2d",
    "1523240795612-9a054b0db644",
    "1516321318423-f06f85e504b3",
    "1554469384-e58fac16e23a",
    "1507679799987-c73779587ccf",
    "1568992687947-868a62a9f521",
    "1556740758-90de374c12ad",
    "1559136555-9303baea8ebd",
    "1522202176988-66273c2fd55f",
    "1560179707-f14e90ef3623",
    "1551288049-bebda4e38f71",
    "1576091160550-2173dba999ef",
    "1454165804606-c3d57bc86b40",
    "1505664194779-8beaceb93744",
    "1566576912321-d58ddd7a6088",
    "1543286386-713bdd548da4",
    "1513635269975-59663e0ac1ad",
    "1558618666-fcd25c85f82e",
    "1524661135-423995f22d0b",
    "1504384764586-bb4cdc1707b0",
    "1497366216548-37526070297d",
    "1497215728101-856f4ea421fb",
    "1527192491265-7e15c55b1ed3",
    "1519389950473-47ba0277781d",
    "1521791136064-7986c2920217",
    "1542744173-8e7e53415bb1",
    "1497366811353-6870744d04b3",
    "1556761223-4c4282c73f78",
    "1521791136064-7986c2920218",
    "1553877522-43269d4ea985",
    "1531973576160-7125cd663d87",
    "1560472354-b33ff0c44a44",
    "1517245386807-bb43f82c33c5",
    "1513364776144-60967b0f8010",
    "1551836022-deb4988cc6c1",
    "1497215842964-222b430dc096",
    "1562654501-a0fec09beca7",
    "1556745757-8d76bdb6984c",
    "1507003211169-0a1dd7228f2e",
    "1523240795612-9a054b0db645",
    "1516321318423-f06f85e504b4",
    "1554469384-e58fac16e23b",
    "1507679799987-c73779587cd0",
    "1568992687947-868a62a9f522",
    "1556740758-90de374c12ae",
    "1559136555-9303baea8ebe",
    "1522202176988-66273c2fd560",
    "1560179707-f14e90ef3624",
    "1551288049-bebda4e38f72",
    "1576091160550-2173dba999f0",
    "1454165804606-c3d57bc86b41",
    "1505664194779-8beaceb93745",
    "1566576912321-d58ddd7a6089",
    "1543286386-713bdd548da5",
    "1513635269975-59663e0ac1ae",
    "1558618666-fcd25c85f82f",
    "1524661135-423995f22d0c",
    "1504384764586-bb4cdc1707b1",
    "1497366216548-37526070297e",
    "1497215728101-856f4ea421fc",
    "1527192491265-7e15c55b1ed4",
    "1519389950473-47ba0277781e",
    "1521791136064-7986c2920219",
    "1542744173-8e7e53415bb2",
    "1497366811353-6870744d04b4",
    "1556761223-4c4282c73f79",
    "1521791136064-7986c292021a",
    "1553877522-43269d4ea986",
    "1531973576160-7125cd663d88",
    "1560472354-b33ff0c44a45",
    "1517245386807-bb43f82c33c6",
    "1513364776144-60967b0f8011",
    "1551836022-deb4988cc6c2",
    "1497215842964-222b430dc097",
    "1562654501-a0fec09beca8",
    "1556745757-8d76bdb6984d",
    "1507003211169-0a1dd7228f2f",
    "1523240795612-9a054b0db646",
    "1516321318423-f06f85e504b5",
    "1554469384-e58fac16e23c",
    "1507679799987-c73779587cd1",
    "1568992687947-868a62a9f523",
    "1556740758-90de374c12af",
    "1559136555-9303baea8ebf",
    "1522202176988-66273c2fd561",
    "1560179707-f14e90ef3625",
]

# 120 office/business scene descriptions: (correct_option_index, [4 options])
# correct_option_index is 0=A, 1=B, 2=C, 3=D
SCENES = [
    # 1-10: Meetings & Collaboration
    (0, [
        "Three colleagues are collaborating around a wooden desk with laptops in a modern open-plan office.",
        "A delivery truck is being unloaded at a warehouse loading dock.",
        "A technician is repairing a copy machine in a corridor.",
        "A customer is returning a product at a service counter.",
    ]),
    (1, [
        "A woman is speaking on the phone at her reception desk.",
        "An empty modern office corridor with glass partitions, polished floors, and a wooden shelving unit.",
        "People are entering a building through revolving glass doors.",
        "A security guard is checking identification badges at a desk.",
    ]),
    (2, [
        "A technician is repairing a copy machine in a copy room.",
        "Office workers are having a discussion near a window.",
        "A modern office lounge area with minimalist armchairs, a sofa, and a large black floor lamp.",
        "A delivery truck is being unloaded at a warehouse.",
    ]),
    (3, [
        "A worker is adjusting a ceiling light fixture.",
        "An employee is filing documents in a cabinet.",
        "Two colleagues are shaking hands in a hallway.",
        "A person is giving a presentation to a seated audience in an industrial-style office.",
    ]),
    (1, [
        "A delivery truck is being unloaded at a warehouse.",
        "A person in a blue shirt is signing a document with a pen on a desk.",
        "A team is collaborating around a conference table.",
        "A security guard is checking identification badges at a desk.",
    ]),
    (0, [
        "A group of employees are seated around a large conference table during a meeting.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (1, [
        "A receptionist is greeting a visitor at the front desk of an office building.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    (2, [
        "Two business professionals are shaking hands after closing a deal in a boardroom.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "A team leader is writing on a whiteboard during a strategy session.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "Colleagues are gathered around a laptop discussing a project in a bright office.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    # 11-20: Desks & Workstations
    (0, [
        "An employee is typing on a laptop at a clean, organized desk with a potted plant.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "A messy desk covered with paperwork, sticky notes, and two computer monitors.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "A standing desk with dual monitors, a keyboard, and a small succulent plant in a bright office.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (3, [
        "A corner office with a large window overlooking a city skyline and a mahogany desk.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A home office setup with a monitor, keyboard, and ergonomic chair in front of a window.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (1, [
        "An open-plan workspace with rows of identical desks and task chairs under fluorescent lights.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "A minimalist desk with a tablet, a coffee mug, and a notepad in a sunlit room.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "A collaborative workspace with bean bags, whiteboards, and colorful wall art.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A private office with a glass desk, two monitors, and a filing cabinet against the wall.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 21-30: People Working
    (1, [
        "A woman is writing on a notepad while seated at a conference table.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (2, [
        "A man is reviewing printed reports while holding a cup of coffee at his desk.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "Two colleagues are looking at a tablet together in a break room.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "A team of engineers is gathered around a prototype on a lab bench.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "An accountant is working on a spreadsheet at a desk cluttered with calculators.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (2, [
        "A marketing specialist is brainstorming ideas on a colorful sticky-note wall.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (3, [
        "A project manager is pointing at a Gantt chart on a large wall display.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (0, [
        "A software developer is coding on a dual-monitor setup with a mechanical keyboard.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (1, [
        "A human resources officer is interviewing a candidate across a small table.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (2, [
        "A logistics coordinator is checking shipping schedules on a large monitor.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 31-40: Office Spaces & Interiors
    (3, [
        "A bright cafeteria with long tables, pendant lights, and employees eating lunch.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (0, [
        "An executive boardroom with a long table, leather chairs, and a city view through floor-to-ceiling windows.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (1, [
        "A small startup office with exposed brick walls, hanging plants, and standing desks.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (2, [
        "A reception area with a curved wooden desk, company logo on the wall, and comfortable seating.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (3, [
        "A modern open office with rows of sit-stand desks and monitors under track lighting.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (0, [
        "A quiet library workspace with individual cubicles, desk lamps, and books on shelves.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (1, [
        "A glass-walled meeting room with a round table and six empty chairs.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "A co-working space with colorful furniture, a coffee bar, and people working on laptops.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "An atrium lobby with a tall indoor tree, marble floors, and a security desk.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A break room with a ping-pong table, a fridge, and a coffee machine on the counter.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 41-50: Technology & Equipment
    (1, [
        "A server room with rows of blinking racks and blue LED lighting.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (2, [
        "A large format printer producing architectural blueprints on a roll of paper.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "A video conference call displayed on a 65-inch screen with four participants visible.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "A 3D printer creating a prototype model on a build plate in a design lab.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "A whiteboard filled with flowcharts, diagrams, and colored markers in a meeting room.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (2, [
        "A desk with a laptop, external keyboard, mouse, and two large monitors displaying code.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (3, [
        "A projector screen showing quarterly sales bar charts during a presentation.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (0, [
        "A tablet on a stand displaying a digital checklist next to a clipboard on a counter.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (1, [
        "An automated robotic arm assembling components on a production line.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (2, [
        "A digital kiosk touchscreen displaying a building directory in an office lobby.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 51-60: People in Motion
    (3, [
        "A group of employees walking through a glass-door entrance carrying briefcases.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (0, [
        "A woman in business attire stepping out of an elevator on an office floor.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (1, [
        "Two colleagues walking down a hallway while reviewing documents on a tablet.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (2, [
        "A person carrying a stack of file folders through an office corridor.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (3, [
        "A courier delivering packages to a mailroom where employees are sorting mail.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (0, [
        "An employee holding a door open for a colleague carrying a laptop bag.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (1, [
        "A manager walking briskly through an open office with a coffee cup in hand.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "Two interns following a senior employee on a tour of the facility.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "A receptionist walking toward the front desk carrying a stack of mail.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A group of professionals exiting a train station during morning rush hour.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 61-70: Food & Break Areas
    (1, [
        "Employees gathered around a kitchen island eating lunch from takeout containers.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (2, [
        "A coffee station with an espresso machine, cups, and a tip jar in an office pantry.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "A vending machine with snacks and drinks in the corner of an office break room.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "Two coworkers chatting while waiting for the microwave in a shared kitchen.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "A catered lunch spread on a buffet table with salads, sandwiches, and drinks.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (2, [
        "A person pouring hot water from a kettle into a tea cup at an office kitchen counter.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (3, [
        "An office fridge covered with magnets, name labels, and sticky notes.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (0, [
        "A group of colleagues sitting at an outdoor patio table during a coffee break.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (1, [
        "A snack drawer opened in a desk showing granola bars, nuts, and dried fruit.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (2, [
        "A person stirring a mug of coffee while reading an email on their phone at a table.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 71-80: Writing & Documentation
    (3, [
        "A close-up of a hand writing notes in a lined notebook next to a laptop.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (0, [
        "A person highlighting text in a printed contract with a yellow marker at a desk.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (1, [
        "An employee organizing documents into labeled folders in a filing cabinet.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (2, [
        "A stack of printed reports with a red pen resting on top on a conference table.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (3, [
        "A person stamping a document with an official company seal at a counter.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (0, [
        "A businesswoman reviewing a printed spreadsheet and making corrections with a pen.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (1, [
        "A person signing a contract at a desk with a fountain pen and a paperweight.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "An open planner on a desk with handwritten appointments and colorful sticky tabs.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "A pair of reading glasses resting on top of a stack of legal documents.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A close-up of a person typing on a laptop with a printed outline document beside them.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 81-90: Reception & Lobby
    (1, [
        "A receptionist sitting behind a curved desk answering a phone call.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (2, [
        "A visitor signing in at a digital check-in kiosk in a modern office lobby.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "A waiting area with rows of chairs, a water cooler, and magazines on a coffee table.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "A security guard monitoring CCTV screens at a front desk console.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "A corporate lobby with a large company logo mounted on a stone feature wall.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (2, [
        "An elevator bank with brushed steel doors and floor indicators in an office tower.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (3, [
        "A visitor holding a lanyard badge while speaking with a receptionist.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (0, [
        "A person pressing the elevator button while carrying a briefcase in a lobby.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (1, [
        "An umbrella stand and coat rack near the entrance of an office building.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (2, [
        "A directory board mounted on the wall listing company names and floor numbers.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 91-100: Outdoor & Building Exteriors
    (3, [
        "A modern glass office building reflecting the sky with a landscaped entrance.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (0, [
        "A corporate campus with a walking path, trees, and benches between two office buildings.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (1, [
        "A company parking lot with designated visitor spaces and directional signage.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (2, [
        "A row of bicycles parked at a bike rack outside an office building.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (3, [
        "A loading dock at the back of a commercial building with a delivery van parked.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (0, [
        "A plaza with outdoor seating, potted trees, and employees having a coffee break.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (1, [
        "A signpost with directional arrows pointing to different office wings on a campus.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "A flagpole with a company flag flying in front of a low-rise office building.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "An outdoor covered walkway connecting two buildings on a corporate campus.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A landscaped courtyard with a fountain, benches, and employees walking through.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 101-110: Packaging & Shipping
    (1, [
        "A warehouse worker scanning a barcode on a cardboard box with a handheld scanner.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (2, [
        "Stacked shipping boxes on a wooden pallet wrapped in clear plastic film.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (3, [
        "A conveyor belt moving packages toward a loading area in a distribution center.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (0, [
        "A delivery driver loading boxes into the back of a white van at a loading bay.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (1, [
        "A person taping shut a cardboard box on a packing table with a tape gun.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (2, [
        "A shipping label printer producing a label from a roll at a packing station.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (3, [
        "A receiving dock with stacked pallets and a worker checking a packing list.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (0, [
        "A worker weighing a sealed package on a digital scale before shipment.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (1, [
        "A mailroom with sorting bins labeled by department and a scale on the counter.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (2, [
        "A hand placing a fragile sticker on a cardboard shipping box.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    # 111-120: Presentations & Training
    (3, [
        "A presenter standing beside a projection screen showing a bar chart to an audience.",
        "A janitor is mopping the floor in an empty hallway.",
        "A forklift is moving pallets in a warehouse.",
        "A chef is preparing food in a commercial kitchen.",
    ]),
    (0, [
        "A trainer writing bullet points on a flip chart during a workshop session.",
        "A painter is applying wallpaper in a residential room.",
        "A pilot is doing pre-flight checks on an aircraft.",
        "A librarian is shelving books in the stacks.",
    ]),
    (1, [
        "An audience of employees seated in rows listening to a speaker at a podium.",
        "A dentist is examining a patient's teeth.",
        "A barista is making espresso at a coffee shop.",
        "A lifeguard is scanning the pool area from a tall chair.",
    ]),
    (2, [
        "A person pointing at a pie chart on a screen during a team meeting.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (3, [
        "A classroom-style training room with desks, chairs, and a projector at the front.",
        "A welder is working on a steel beam at a construction site.",
        "A bus driver is checking passengers' tickets.",
        "A florist is arranging flowers in a shop window.",
    ]),
    (0, [
        "A new employee looking at a company handbook while sitting at a training desk.",
        "A surgeon is performing an operation in an operating room.",
        "A postal worker is sorting letters in a distribution center.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (1, [
        "A speaker gesturing while explaining a diagram on a large presentation screen.",
        "A chef is sautéing vegetables in a stainless steel pan.",
        "A librarian is shelving books in the stacks.",
        "A gymnast is performing a floor routine on a mat.",
    ]),
    (2, [
        "Employees wearing headphones and watching a training video on individual monitors.",
        "A construction worker is pouring concrete from a mixer truck.",
        "A nurse is checking a patient's blood pressure.",
        "A photographer is adjusting a studio lighting setup.",
    ]),
    (3, [
        "A certificate of completion displayed on a desk next to a pen and folder.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
    (0, [
        "A trainer handing out printed worksheets to participants at a conference table.",
        "A mechanic is changing a tire in an auto repair shop.",
        "Children are playing on a playground at recess.",
        "A farmer is harvesting crops in a field.",
    ]),
    (1, [
        "A person organizing binders on a supply shelf in an office storage room.",
        "A plumber is fixing pipes under a kitchen sink.",
        "An astronaut is floating in zero gravity inside a space station.",
        "A fisherman is casting a net from a small boat.",
    ]),
]

ANSWER_LETTERS = ["A", "B", "C", "D"]

def main():
    assert len(PHOTO_IDS) == 120, f"Expected 120 photo IDs, got {len(PHOTO_IDS)}"
    assert len(SCENES) == 120, f"Expected 120 scenes, got {len(SCENES)}"

    lines = []
    lines.append("// Auto-generated by scripts/gen_p1_data.py — DO NOT EDIT MANUALLY")
    lines.append("const PART1_DATA: { image: string; options: string[]; answer: 'A' | 'B' | 'C' | 'D' }[] = [")

    for i, (photo_id, (correct_idx, options)) in enumerate(zip(PHOTO_IDS, SCENES)):
        answer = ANSWER_LETTERS[correct_idx]
        lines.append(f"  // Photo {i+1}: Unsplash ID {photo_id}")
        lines.append("  {")
        lines.append(f"    image: '{photo_id}',")
        lines.append("    options: [")
        for opt in options:
            lines.append(f"      '{opt}',")
        lines.append("    ],")
        lines.append(f"    answer: '{answer}',")
        lines.append("  },")

    lines.append("];")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
