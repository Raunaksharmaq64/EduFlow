import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "eduflow")

SYLLABUS_DATA = [
    # ========================== CLASS 6 ==========================
    {
        "grade": "6th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Knowing Our Numbers", "topics": ["Comparing Numbers", "Large Numbers", "Roman Numerals"]},
            {"chapter_number": 2, "chapter_name": "Whole Numbers", "topics": ["Natural Numbers", "Number Line", "Properties of Whole Numbers"]},
            {"chapter_number": 3, "chapter_name": "Playing with Numbers", "topics": ["Factors and Multiples", "Prime and Composite", "Divisibility Rules", "HCF and LCM"]},
            {"chapter_number": 4, "chapter_name": "Basic Geometrical Ideas", "topics": ["Points, Lines and Line segments", "Angles", "Polygons, Triangles and Quadrilaterals", "Circles"]},
            {"chapter_number": 5, "chapter_name": "Understanding Elementary Shapes", "topics": ["Measuring Line Segments", "Angles - Right, Straight and Acute", "Perimeter and Area Introduction", "3D Shapes"]},
            {"chapter_number": 6, "chapter_name": "Integers", "topics": ["Negative Numbers", "Number Line representation", "Addition and Subtraction of Integers"]},
            {"chapter_number": 7, "chapter_name": "Fractions", "topics": ["Proper, Improper and Mixed Fractions", "Equivalent Fractions", "Addition and Subtraction of Fractions"]},
            {"chapter_number": 8, "chapter_name": "Decimals", "topics": ["Tenths and Hundredths", "Comparing Decimals", "Decimals as fractions", "Addition and Subtraction of Decimals"]},
            {"chapter_number": 9, "chapter_name": "Data Handling", "topics": ["Recording and Organising Data", "Pictographs", "Bar Graphs"]},
            {"chapter_number": 10, "chapter_name": "Mensuration", "topics": ["Perimeter of plane figures", "Area of Rectangle and Square"]},
            {"chapter_number": 11, "chapter_name": "Algebra", "topics": ["Matchstick Patterns", "Idea of Variable", "Expressions with variables", "Equations"]},
            {"chapter_number": 12, "chapter_name": "Ratio and Proportion", "topics": ["Ratio Concept", "Proportion", "Unitary Method"]}
        ]
    },
    {
        "grade": "6th Grade",
        "subject": "Science",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Components of Food", "topics": ["Carbohydrates, Proteins and Fats", "Vitamins and Minerals", "Balanced Diet", "Deficiency Diseases"]},
            {"chapter_number": 2, "chapter_name": "Sorting Materials into Groups", "topics": ["Appearance and Hardness", "Solubility in Water", "Transparency, Opacity and Translucency"]},
            {"chapter_number": 3, "chapter_name": "Separation of Substances", "topics": ["Handpicking, Winnowing and Sieving", "Sedimentation and Decantation", "Evaporation and Condensation"]},
            {"chapter_number": 4, "chapter_name": "Getting to Know Plants", "topics": ["Herbs, Shrubs and Trees", "Stem and Leaf structure", "Root Types (Taproot and Fibrous)", "Flower parts"]},
            {"chapter_number": 5, "chapter_name": "Body Movements", "topics": ["Human Skeleton and Joints", "Gait of Animals (Earthworm, Snail, Fish)"]},
            {"chapter_number": 6, "chapter_name": "The Living Organisms and Their Surroundings", "topics": ["Habitat and Adaptation", "Biotic and Abiotic components", "Characteristics of Living Beings"]},
            {"chapter_number": 7, "chapter_name": "Motion and Measurement of Distances", "topics": ["Standard Units of Measurement", "Types of Motion (Rectilinear, Circular, Periodic)"]},
            {"chapter_number": 8, "chapter_name": "Light, Shadows and Reflections", "topics": ["Transparent, Opaque and Translucent objects", "Formation of Shadows", "Pinhole Camera and Mirrors"]},
            {"chapter_number": 9, "chapter_name": "Electricity and Circuits", "topics": ["Electric Cell and Bulb", "Closed and Open Circuits", "Electric Switch", "Conductors and Insulators"]},
            {"chapter_number": 10, "chapter_name": "Fun with Magnets", "topics": ["Magnetic and Non-magnetic materials", "Poles of a Magnet", "Finding directions with compass", "Attraction and Repulsion"]},
            {"chapter_number": 11, "chapter_name": "Air Around Us", "topics": ["Composition of Air", "Role of Atmosphere", "Oxygen and Nitrogen Cycle basics"]}
        ]
    },
    # ========================== CLASS 7 ==========================
    {
        "grade": "7th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Integers", "topics": ["Properties of Addition & Subtraction", "Multiplication and Division of Integers", "Word problems"]},
            {"chapter_number": 2, "chapter_name": "Fractions and Decimals", "topics": ["Multiplication & Division of Fractions", "Multiplication & Division of Decimals"]},
            {"chapter_number": 3, "chapter_name": "Data Handling", "topics": ["Mean, Median and Mode", "Double Bar Graphs", "Chance and Probability"]},
            {"chapter_number": 4, "chapter_name": "Simple Equations", "topics": ["Setting up Equations", "Solving Equations", "Practical applications"]},
            {"chapter_number": 5, "chapter_name": "Lines and Angles", "topics": ["Complementary and Supplementary angles", "Linear Pair", "Parallel lines and Transversal"]},
            {"chapter_number": 6, "chapter_name": "The Triangle and its Properties", "topics": ["Medians and Altitudes", "Exterior Angle Property", "Angle Sum Property", "Pythagoras Theorem"]},
            {"chapter_number": 7, "chapter_name": "Comparing Quantities", "topics": ["Percentage conversion", "Profit and Loss", "Simple Interest"]},
            {"chapter_number": 8, "chapter_name": "Rational Numbers", "topics": ["Equivalent Rational Numbers", "Rational numbers on Number Line", "Operations (+, -, *, /)"]},
            {"chapter_number": 9, "chapter_name": "Perimeter and Area", "topics": ["Area of Parallelogram & Triangle", "Circumference and Area of Circle"]},
            {"chapter_number": 10, "chapter_name": "Algebraic Expressions", "topics": ["Like and Unlike Terms", "Addition and Subtraction of expressions", "Finding expression values"]},
            {"chapter_number": 11, "chapter_name": "Exponents and Powers", "topics": ["Laws of Exponents", "Expressing large numbers in scientific notation"]},
            {"chapter_number": 12, "chapter_name": "Symmetry", "topics": ["Line Symmetry", "Rotational Symmetry"]},
            {"chapter_number": 13, "chapter_name": "Visualising Solid Shapes", "topics": ["Nets for 3D Shapes", "Oblique and Isometric sketches"]}
        ]
    },
    {
        "grade": "7th Grade",
        "subject": "Science",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Nutrition in Plants", "topics": ["Photosynthesis", "Saprophytic and Parasitic nutrition", "Symbiosis"]},
            {"chapter_number": 2, "chapter_name": "Nutrition in Animals", "topics": ["Human Digestive System", "Digestion in Grass Eating Animals", "Amoeba feeding mechanism"]},
            {"chapter_number": 3, "chapter_name": "Heat", "topics": ["Clinical and Laboratory Thermometers", "Conduction, Convection and Radiation", "Sea Breeze and Land Breeze"]},
            {"chapter_number": 4, "chapter_name": "Acids, Bases and Salts", "topics": ["Natural indicators", "Neutralisation reactions", "Neutralisation in everyday life"]},
            {"chapter_number": 5, "chapter_name": "Physical and Chemical Changes", "topics": ["Characteristics of physical/chemical changes", "Rusting of Iron", "Crystallisation"]},
            {"chapter_number": 6, "chapter_name": "Respiration in Organisms", "topics": ["Aerobic vs Anaerobic Respiration", "Human Respiratory System", "Breathing in other animals (Fish, Earthworm)"]},
            {"chapter_number": 7, "chapter_name": "Transportation in Animals and Plants", "topics": ["Human Circulatory System (Blood, Heart)", "Excretory System in Humans", "Transport of water and minerals in plants"]},
            {"chapter_number": 8, "chapter_name": "Reproduction in Plants", "topics": ["Asexual reproduction modes", "Sexual reproduction & Pollination", "Fertilisation and Seed Dispersal"]},
            {"chapter_number": 9, "chapter_name": "Motion and Time", "topics": ["Speed and its units", "Measurement of Time", "Distance-Time Graph"]},
            {"chapter_number": 10, "chapter_name": "Electric Current and its Effects", "topics": ["Symbols of electric components", "Heating effect and Fuse", "Magnetic effect and Electromagnet"]},
            {"chapter_number": 11, "chapter_name": "Light", "topics": ["Reflection of Light", "Concave and Convex Mirrors", "Concave and Convex Lenses", "Sunlight and Rainbow"]},
            {"chapter_number": 12, "chapter_name": "Forests: Our Lifeline", "topics": ["Forest Canopy and Understorey", "Decomposers and Humus", "Interdependence of plants and animals"]},
            {"chapter_number": 13, "chapter_name": "Wastewater Story", "topics": ["Sewage treatment process", "Sanitation at public places", "Alternative arrangements for sewage disposal"]}
        ]
    },
    # ========================== CLASS 8 ==========================
    {
        "grade": "8th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Rational Numbers", "topics": ["Closure, Commutative & Associative Properties", "Additive/Multiplicative Identity & Inverse", "Rational numbers between two numbers"]},
            {"chapter_number": 2, "chapter_name": "Linear Equations in One Variable", "topics": ["Solving equations having variables on both sides", "Applications/Word problems"]},
            {"chapter_number": 3, "chapter_name": "Understanding Quadrilaterals", "topics": ["Sum of exterior angles of polygon", "Kinds of Quadrilaterals", "Properties of Parallelogram, Rhombus, Rectangle, Square"]},
            {"chapter_number": 4, "chapter_name": "Data Handling", "topics": ["Grouping Data & Histograms", "Pie Charts", "Probability and Outcomes"]},
            {"chapter_number": 5, "chapter_name": "Squares and Square Roots", "topics": ["Properties of Square Numbers", "Finding Square Root by Prime Factorisation & Division method"]},
            {"chapter_number": 6, "chapter_name": "Cubes and Cube Roots", "topics": ["Properties of Cube Numbers", "Finding Cube Root by Prime Factorisation"]},
            {"chapter_number": 7, "chapter_name": "Comparing Quantities", "topics": ["Ratios and Percentages", "Discount and Sales Tax / GST", "Compound Interest Formula & Applications"]},
            {"chapter_number": 8, "chapter_name": "Algebraic Expressions and Identities", "topics": ["Addition, Subtraction & Multiplication of Expressions", "Standard Identities"]},
            {"chapter_number": 9, "chapter_name": "Mensuration", "topics": ["Area of Trapezium, General Quadrilateral & Polygons", "Surface Area and Volume of Cube, Cuboid & Cylinder"]},
            {"chapter_number": 10, "chapter_name": "Exponents and Powers", "topics": ["Powers with Negative Exponents", "Laws of Exponents", "Standard form of very small numbers"]},
            {"chapter_number": 11, "chapter_name": "Direct and Inverse Proportions", "topics": ["Direct Proportion", "Inverse Proportion", "Practical applications"]},
            {"chapter_number": 12, "chapter_name": "Factorisation", "topics": ["Common Factors method", "Factorisation using identities", "Division of algebraic expressions"]},
            {"chapter_number": 13, "chapter_name": "Introduction to Graphs", "topics": ["Linear Graphs", "Coordinates of a point", "Applications of Graphs"]}
        ]
    },
    {
        "grade": "8th Grade",
        "subject": "Science",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Crop Production and Management", "topics": ["Preparation of Soil & Sowing", "Adding Manure and Fertilizers", "Irrigation & Protection from Weeds", "Harvesting and Storage"]},
            {"chapter_number": 2, "chapter_name": "Microorganisms: Friend and Foe", "topics": ["Types of Microorganisms", "Commercial and Medical uses", "Harmful microbes and Diseases", "Food Preservation & Nitrogen Cycle"]},
            {"chapter_number": 3, "chapter_name": "Coal and Petroleum", "topics": ["Natural Resources classification", "Coal, Coal Tar, Coal Gas", "Petroleum refining & Natural Gas", "Energy conservation"]},
            {"chapter_number": 4, "chapter_name": "Combustion and Flame", "topics": ["Conditions for combustion", "Ignition Temperature and Inflammable substances", "How to control fire", "Structure of a Flame & Fuel efficiency"]},
            {"chapter_number": 5, "chapter_name": "Conservation of Plants and Animals", "topics": ["Deforestation consequences", "Biosphere Reserves, Flora and Fauna", "National Parks and Wildlife Sanctuaries", "Red Data Book & Migration"]},
            {"chapter_number": 6, "chapter_name": "Reproduction in Animals", "topics": ["Sexual reproduction (Male/Female organs)", "Fertilisation (Internal/External)", "Viviparous and Oviparous", "Asexual reproduction (Budding, Binary Fission)"]},
            {"chapter_number": 7, "chapter_name": "Reaching the Age of Adolescence", "topics": ["Changes at Puberty", "Secondary Sexual Characters", "Role of Hormones", "Reproductive health and hygiene"]},
            {"chapter_number": 8, "chapter_name": "Force and Pressure", "topics": ["Forces due to interaction", "Contact forces vs Non-contact forces", "Pressure exerted by liquids and gases", "Atmospheric Pressure"]},
            {"chapter_number": 9, "chapter_name": "Friction", "topics": ["Factors affecting Friction", "Increasing and reducing Friction", "Fluid Friction (Drag)"]},
            {"chapter_number": 10, "chapter_name": "Sound", "topics": ["Sound produced by vibrating bodies", "Propagation of Sound through mediums", "Audible and Inaudible range", "Noise and Music, Noise Pollution"]},
            {"chapter_number": 11, "chapter_name": "Chemical Effects of Electric Current", "topics": ["Electrical conductivity of liquids", "Electroplating process & applications"]},
            {"chapter_number": 12, "chapter_name": "Some Natural Phenomena", "topics": ["Electric Charges & Transfer of Charge", "Lightning story & safety", "Earthquakes causes & protection"]},
            {"chapter_number": 13, "chapter_name": "Light", "topics": ["Reflection Laws", "Regular and Diffuse Reflection", "Structure of Human Eye & Blind Spot", "Visually challenged support (Braille System)"]}
        ]
    },
    # ========================== CLASS 9 ==========================
    {
        "grade": "9th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Number Systems", "topics": ["Irrational Numbers", "Real Numbers and their Decimal Expansions", "Representing Real Numbers on Number Line", "Rationalising the Denominator", "Exponent Laws for Real Numbers"]},
            {"chapter_number": 2, "chapter_name": "Polynomials", "topics": ["Polynomials in One Variable", "Zeroes of a Polynomial", "Remainder Theorem & Factor Theorem", "Factorisation of Quadratic and Cubic Polynomials", "Algebraic Identities"]},
            {"chapter_number": 3, "chapter_name": "Coordinate Geometry", "topics": ["Cartesian System", "Plotting a Point in the Plane if Coordinates are given"]},
            {"chapter_number": 4, "chapter_name": "Linear Equations in Two Variables", "topics": ["Linear Equations representation", "Solution of a Linear Equation", "Graph of a Linear Equation in Two Variables"]},
            {"chapter_number": 5, "chapter_name": "Introduction to Euclid's Geometry", "topics": ["Euclid's Definitions, Axioms and Postulates", "Equivalent Versions of Euclid's Fifth Postulate"]},
            {"chapter_number": 6, "chapter_name": "Lines and Angles", "topics": ["Basic terms and definitions", "Intersecting lines and Non-intersecting lines", "Pairs of Angles", "Parallel Lines and a Transversal", "Angle Sum Property of a Triangle"]},
            {"chapter_number": 7, "chapter_name": "Triangles", "topics": ["Congruence of Triangles", "Congruence Criteria (SAS, ASA, SSS, RHS)", "Properties of a Triangle", "Inequalities in a Triangle"]},
            {"chapter_number": 8, "chapter_name": "Quadrilaterals", "topics": ["Angle Sum Property of a Quadrilateral", "Types of Quadrilaterals", "Properties of a Parallelogram", "Mid-point Theorem"]},
            {"chapter_number": 9, "chapter_name": "Circles", "topics": ["Angle subtended by chord at a point", "Perpendicular from centre to chord", "Equal chords and their distances", "Angle subtended by arc of circle", "Cyclic Quadrilaterals"]},
            {"chapter_number": 10, "chapter_name": "Heron's Formula", "topics": ["Area of a Triangle by Heron's Formula", "Applications in finding Area of Quadrilaterals"]},
            {"chapter_number": 11, "chapter_name": "Surface Areas and Volumes", "topics": ["Surface Area & Volume of a Right Circular Cone", "Surface Area & Volume of a Sphere & Hemisphere"]},
            {"chapter_number": 12, "chapter_name": "Statistics", "topics": ["Graphical representation of data (Bar graphs, Histograms, Frequency Polygons)", "Measures of Central Tendency (Mean, Median, Mode)"]}
        ]
    },
    {
        "grade": "9th Grade",
        "subject": "Science",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Matter in Our Surroundings", "topics": ["Physical nature of Matter", "States of Matter (Solid, Liquid, Gas)", "Interconversion of States (Melting, Vaporisation, Sublimation)", "Evaporation and cooling effect"]},
            {"chapter_number": 2, "chapter_name": "Is Matter Around Us Pure?", "topics": ["Mixtures vs Pure Substances", "Solutions, Suspensions and Colloids", "Separation techniques", "Physical and Chemical Changes"]},
            {"chapter_number": 3, "chapter_name": "Atoms and Molecules", "topics": ["Laws of Chemical Combination", "Dalton's Atomic Theory", "Atomic and Molecular Mass", "Writing Chemical Formulae", "Mole Concept"]},
            {"chapter_number": 4, "chapter_name": "Structure of the Atom", "topics": ["Thomson's, Rutherford's and Bohr's Atomic Models", "Valency", "Atomic Number and Mass Number", "Isotopes and Isobars"]},
            {"chapter_number": 5, "chapter_name": "The Fundamental Unit of Life", "topics": ["Discovery of Cell & Microscope study", "Plasma Membrane, Cell Wall, Nucleus", "Cytoplasm & Cell Organelles (Mitochondria, Plastids, Ribosomes)"]},
            {"chapter_number": 6, "chapter_name": "Tissues", "topics": ["Plant Tissues (Meristematic and Permanent)", "Animal Tissues (Epithelial, Connective, Muscular, Nervous)"]},
            {"chapter_number": 7, "chapter_name": "Motion", "topics": ["Distance and Displacement", "Uniform and Non-uniform motion", "Acceleration", "Equations of Motion", "Uniform Circular Motion"]},
            {"chapter_number": 8, "chapter_name": "Force and Laws of Motion", "topics": ["Balanced and Unbalanced forces", "First Law of Motion & Inertia", "Second Law of Motion (F=ma) & Momentum", "Third Law of Motion & Conservation of Momentum"]},
            {"chapter_number": 9, "chapter_name": "Gravitation", "topics": ["Universal Law of Gravitation", "Free Fall & Acceleration due to gravity (g)", "Mass vs Weight", "Thrust, Pressure and Archimedes' Principle", "Relative Density"]},
            {"chapter_number": 10, "chapter_name": "Work and Energy", "topics": ["Scientific concept of Work", "Forms of Energy (Kinetic and Potential)", "Law of Conservation of Energy", "Power and commercial unit of energy"]},
            {"chapter_number": 11, "chapter_name": "Sound", "topics": ["Production and Propagation of Sound", "Reflection of Sound & Echo", "Range of Hearing & Ultrasound application", "Structure of Human Ear"]},
            {"chapter_number": 12, "chapter_name": "Improvement in Food Resources", "topics": ["Crop Variety Improvement & Management", "Crop Protection & Fertilizers", "Animal Husbandry (Cattle, Poultry, Fish production, Beekeeping)"]}
        ]
    },
    # ========================== CLASS 10 ==========================
    {
        "grade": "10th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Real Numbers", "topics": ["Fundamental Theorem of Arithmetic", "Revisiting Irrational Numbers (Proofs)", "Revisiting Rational Numbers and their decimal expansions"]},
            {"chapter_number": 2, "chapter_name": "Polynomials", "topics": ["Geometrical Meaning of Zeroes", "Relationship between Zeroes and Coefficients of Quadratic Polynomial", "Division Algorithm basics"]},
            {"chapter_number": 3, "chapter_name": "Pair of Linear Equations in Two Variables", "topics": ["Graphical Method of Solution", "Algebraic Methods: Substitution and Elimination Methods", "Equations reducible to linear equations"]},
            {"chapter_number": 4, "chapter_name": "Quadratic Equations", "topics": ["Standard form of Quadratic Equation", "Solution by Factorisation & Quadratic Formula", "Nature of Roots & Discriminant"]},
            {"chapter_number": 5, "chapter_name": "Arithmetic Progressions", "topics": ["Definition of Arithmetic Progression (AP)", "Finding nth term of an AP", "Sum of first n terms of an AP"]},
            {"chapter_number": 6, "chapter_name": "Triangles", "topics": ["Similar Figures", "Basic Proportionality Theorem (Thales Theorem)", "Criteria for Similarity (AAA, SSS, SAS)", "Pythagoras Theorem & applications"]},
            {"chapter_number": 7, "chapter_name": "Coordinate Geometry", "topics": ["Distance Formula", "Section Formula", "Area of a Triangle using coordinates"]},
            {"chapter_number": 8, "chapter_name": "Introduction to Trigonometry", "topics": ["Trigonometric Ratios", "Trigonometric Ratios of Specific Angles (30, 45, 60)", "Trigonometric Identities (sin^2 + cos^2 = 1)"]},
            {"chapter_number": 9, "chapter_name": "Some Applications of Trigonometry", "topics": ["Heights and Distances", "Angle of Elevation and Angle of Depression"]},
            {"chapter_number": 10, "chapter_name": "Circles", "topics": ["Tangent to a circle", "Number of tangents from a point on a circle"]},
            {"chapter_number": 11, "chapter_name": "Areas Related to Circles", "topics": ["Area of Sector of a Circle", "Area of Segment of a Circle"]},
            {"chapter_number": 12, "chapter_name": "Surface Areas and Volumes", "topics": ["Surface Area of Combination of Solids", "Volume of Combination of Solids", "Frustum of a Cone"]},
            {"chapter_number": 13, "chapter_name": "Statistics", "topics": ["Mean of Grouped Data (Direct/Assumed Mean methods)", "Mode of Grouped Data", "Median of Grouped Data", "Cumulative Frequency Graph (Ogive)"]},
            {"chapter_number": 14, "chapter_name": "Probability", "topics": ["Theoretical Probability", "Elementary events", "Complements and simple card/coin problems"]}
        ]
    },
    {
        "grade": "10th Grade",
        "subject": "Science",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Chemical Reactions and Equations", "topics": ["Writing Chemical Equations", "Balanced Chemical Equations", "Types of Chemical Reactions (Combination, Decomposition, Displacement, Redox)", "Corrosion and Rancidity"]},
            {"chapter_number": 2, "chapter_name": "Acids, Bases and Salts", "topics": ["Chemical Properties of Acids & Bases", "pH Scale and everyday importance", "Salts Family (Sodium Hydroxide, Bleaching Powder, Baking/Washing Soda, Plaster of Paris)"]},
            {"chapter_number": 3, "chapter_name": "Metals and Non-metals", "topics": ["Physical & Chemical properties of Metals & Non-metals", "Reactivity Series", "Properties of Ionic Compounds", "Basic Metallurgical processes & Corrosion"]},
            {"chapter_number": 4, "chapter_name": "Carbon and its Compounds", "topics": ["Covalent bonding in Carbon", "Versatile nature of Carbon", "Saturated & Unsaturated Carbon compounds", "Chemical properties of Carbon compounds", "Ethanol & Ethanoic Acid", "Soaps and Detergents"]},
            {"chapter_number": 5, "chapter_name": "Life Processes", "topics": ["Nutrition (Autotrophic and Heterotrophic)", "Respiration (Aerobic and Anaerobic)", "Transportation (Plants and Human Circulatory system)", "Excretion (Humans and Plants)"]},
            {"chapter_number": 6, "chapter_name": "Control and Coordination", "topics": ["Nervous System (Reflex Action, Human Brain)", "Coordination in Plants", "Hormones in Animals"]},
            {"chapter_number": 7, "chapter_name": "How do Organisms Reproduce?", "topics": ["Asexual reproduction modes", "Sexual reproduction in flowering plants", "Sexual reproduction in Humans", "Reproductive health and contraceptive methods"]},
            {"chapter_number": 8, "chapter_name": "Heredity", "topics": ["Mendel's laws of Inheritance", "Monohybrid and Dihybrid Crosses", "Sex Determination"]},
            {"chapter_number": 9, "chapter_name": "Light – Reflection and Refraction", "topics": ["Reflection by Spherical Mirrors", "Mirror Formula and Magnification", "Refraction and Refractive Index", "Refraction by Spherical Lenses & Lens Formula", "Power of a Lens"]},
            {"chapter_number": 10, "chapter_name": "The Human Eye and the Colourful World", "topics": ["Structure and defects of Human Eye (Myopia, Hypermetropia)", "Refraction through a Prism", "Dispersion of light", "Atmospheric Refraction & Scattering of light (Tyndall Effect)"]},
            {"chapter_number": 11, "chapter_name": "Electricity", "topics": ["Electric Current and Potential Difference", "Ohm's Law & Resistance", "Factors affecting resistance (Resistivity)", "Resistors in Series and Parallel", "Heating Effect of Electric Current & Electric Power"]},
            {"chapter_number": 12, "chapter_name": "Magnetic Effects of Electric Current", "topics": ["Magnetic Field and Field Lines", "Field due to Current Carrying Conductor (Straight wire, Loop, Solenoid)", "Force on current carrying conductor & Electric Motor", "Electromagnetic Induction & Electric Generator", "Domestic Electric Circuits"]},
            {"chapter_number": 13, "chapter_name": "Our Environment", "topics": ["Ecosystem components", "Food Chains and Food Webs", "Ozone Layer Depletion & Waste Disposal Management"]}
        ]
    },
    # ========================== CLASS 11 ==========================
    {
        "grade": "11th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Sets", "topics": ["Representation of Sets", "Empty, Finite, Infinite and Equal Sets", "Subsets and Power Sets", "Venn Diagrams & Operations (Union, Intersection, Difference)"]},
            {"chapter_number": 2, "chapter_name": "Relations and Functions", "topics": ["Cartesian Product of Sets", "Relation, Domain, Codomain, Range", "Functions & Graphs (Identity, Polynomial, Rational, Signum, Greatest Integer)"]},
            {"chapter_number": 3, "chapter_name": "Trigonometric Functions", "topics": ["Angles measurement (Radian and Degree)", "Trigonometric Functions sign & properties", "Sum and Difference formulas", "Trigonometric Equations"]},
            {"chapter_number": 4, "chapter_name": "Complex Numbers and Quadratic Equations", "topics": ["Complex Numbers definition", "Algebraic properties of Complex numbers", "Argand Plane and Polar representation", "Quadratic equations in complex system"]},
            {"chapter_number": 5, "chapter_name": "Linear Inequalities", "topics": ["Algebraic solutions of Linear inequalities in one variable", "Graphical representation in two variables"]},
            {"chapter_number": 6, "chapter_name": "Permutations and Combinations", "topics": ["Fundamental Principle of Counting", "Permutations (nPr formula)", "Combinations (nCr formula)", "Practical applications"]},
            {"chapter_number": 7, "chapter_name": "Binomial Theorem", "topics": ["History & Statement of Binomial Theorem", "General and Middle terms in expansion"]},
            {"chapter_number": 8, "chapter_name": "Sequences and Series", "topics": ["Arithmetic Progression (AP) recap", "Geometric Progression (GP)", "Relationship between AM and GM"]},
            {"chapter_number": 9, "chapter_name": "Straight Lines", "topics": ["Slope of a Line & Angle between lines", "Various forms of equations of a line", "Distance of a Point from a line"]},
            {"chapter_number": 10, "chapter_name": "Conic Sections", "topics": ["Sections of a Cone", "Equations of Circle, Parabola, Ellipse and Hyperbola"]},
            {"chapter_number": 11, "chapter_name": "Introduction to Three Dimensional Geometry", "topics": ["Coordinate Axes and Coordinate Planes in 3D", "Distance between two points in 3D space", "Section Formula in 3D"]},
            {"chapter_number": 12, "chapter_name": "Limits and Derivatives", "topics": ["Limits intuitive idea", "Limits algebra & standard formulas", "Definition of Derivative", "Algebra of derivatives & Chain rule"]},
            {"chapter_number": 13, "chapter_name": "Statistics", "topics": ["Measures of Dispersion (Range, Mean Deviation)", "Variance and Standard Deviation", "Analysis of frequency distributions"]},
            {"chapter_number": 14, "chapter_name": "Probability", "topics": ["Random Experiments and Sample Space", "Events (Mutual exclusive, Exhaustive)", "Axiomatic Probability"]}
        ]
    },
    {
        "grade": "11th Grade",
        "subject": "Physics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Units and Measurements", "topics": ["SI Units", "Significant Figures & Errors", "Dimensions of Physical Quantities", "Dimensional Analysis and its applications"]},
            {"chapter_number": 2, "chapter_name": "Motion in a Straight Line", "topics": ["Position, Path Length and Displacement", "Average speed/velocity & Instantaneous velocity", "Equations of Uniformly Accelerated Motion", "Relative Velocity"]},
            {"chapter_number": 3, "chapter_name": "Motion in a Plane", "topics": ["Scalars and Vectors addition/subtraction", "Resolution of Vectors & Unit vectors", "Projectile Motion", "Uniform Circular Motion"]},
            {"chapter_number": 4, "chapter_name": "Laws of Motion", "topics": ["Newton's First, Second and Third Laws", "Law of Conservation of Linear Momentum", "Equilibrium of a particle", "Friction laws & dynamics of circular motion"]},
            {"chapter_number": 5, "chapter_name": "Work, Energy and Power", "topics": ["Work done by constant & variable forces", "Kinetic Energy & Work-Energy Theorem", "Potential Energy and Conservation of Mechanical Energy", "Collisions (Elastic and Inelastic)"]},
            {"chapter_number": 6, "chapter_name": "System of Particles and Rotational Motion", "topics": ["Centre of Mass of a two-particle system", "Torque and Angular Momentum", "Equilibrium of a Rigid Body & Moment of Inertia", "Kinematics and Dynamics of Rotational Motion"]},
            {"chapter_number": 7, "chapter_name": "Gravitation", "topics": ["Kepler's Laws of Planetary Motion", "Newton's Law of Gravitation & Acceleration due to gravity (g)", "Gravitational Potential Energy & Escape Velocity", "Orbital Velocity of Satellite & Geostationary Satellites"]},
            {"chapter_number": 8, "chapter_name": "Mechanical Properties of Solids", "topics": ["Elastic behaviour of materials", "Stress, Strain and Hooke's Law", "Young's Modulus, Shear Modulus and Bulk Modulus"]},
            {"chapter_number": 9, "chapter_name": "Mechanical Properties of Fluids", "topics": ["Pressure in fluid (Pascal's Law)", "Streamline flow & Equation of Continuity", "Bernoulli's Principle & Applications", "Viscosity, Stokes' Law and Terminal Velocity", "Surface Tension & Capillarity"]},
            {"chapter_number": 10, "chapter_name": "Thermal Properties of Matter", "topics": ["Temperature and Heat measurement", "Thermal Expansion of solids, liquids & gases", "Specific Heat Capacity & Calorimetry", "Latent Heat & Modes of Heat Transfer (Conduction, Convection, Radiation)"]},
            {"chapter_number": 11, "chapter_name": "Thermodynamics", "topics": ["Thermal Equilibrium & Zeroth Law", "First Law of Thermodynamics", "Thermodynamic processes (Isothermal, Adiabatic, Isobaric, Isochoric)", "Heat Engines and Second Law of Thermodynamics"]},
            {"chapter_number": 12, "chapter_name": "Kinetic Theory", "topics": ["Molecular nature of Matter & Ideal Gas behavior", "Kinetic Theory postulates", "Law of Equipartition of Energy", "Mean Free Path"]},
            {"chapter_number": 13, "chapter_name": "Oscillations", "topics": ["Periodic and Oscillatory Motions", "Simple Harmonic Motion (SHM) & energy in SHM", "Simple Pendulum oscillations", "Damped and Forced oscillations"]},
            {"chapter_number": 14, "chapter_name": "Waves", "topics": ["Transverse and Longitudinal Waves", "Displacement relation for progressive wave", "Speed of traveling wave & Principle of Superposition", "Standing waves, Beats and Doppler Effect"]}
        ]
    },
    {
        "grade": "11th Grade",
        "subject": "Chemistry",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Some Basic Concepts of Chemistry", "topics": ["Nature of Matter & Laws of chemical combination", "Atomic and Molecular Masses", "Mole Concept and Molar Mass", "Empirical & Molecular Formulas, Stoichiometry"]},
            {"chapter_number": 2, "chapter_name": "Structure of Atom", "topics": ["Discovery of subatomic particles", "Bohr's Model for Hydrogen Atom", "Quantum Mechanical Model of Atom (Heisenberg, de Broglie)", "Quantum Numbers & Electronic Configuration"]},
            {"chapter_number": 3, "chapter_name": "Classification of Elements and Periodicity in Properties", "topics": ["Modern Periodic Law", "Electronic configurations of elements & Blocks", "Periodic trends in physical/chemical properties (Ionisation, Electronegativity)"]},
            {"chapter_number": 4, "chapter_name": "Chemical Bonding and Molecular Structure", "topics": ["Kossel-Lewis approach & Ionic Bond", "VSEPR Theory", "Valence Bond Theory & Hybridisation (sp, sp2, sp3)", "Molecular Orbital Theory (Homo-nuclear molecules)"]},
            {"chapter_number": 5, "chapter_name": "Chemical Thermodynamics", "topics": ["State Functions & Thermodynamic Processes", "First Law of Thermodynamics (Work, Heat, Internal Energy)", "Enthalpy and Calorimetry", "Spontaneity, Entropy and Gibbs Free Energy"]},
            {"chapter_number": 6, "chapter_name": "Equilibrium", "topics": ["Equilibrium in physical & chemical processes", "Law of Chemical Equilibrium & Le Chatelier's Principle", "Ionic Equilibrium (Acids, Bases, pH scale)", "Buffer Solutions & Solubility Product"]},
            {"chapter_number": 7, "chapter_name": "Redox Reactions", "topics": ["Classical and electronic concept of redox", "Oxidation Number concept", "Balancing Redox Reactions (Half-reaction method)"]},
            {"chapter_number": 8, "chapter_name": "Organic Chemistry – Some Basic Principles and Techniques", "topics": ["Tetravalency of Carbon & IUPAC Nomenclature", "Isomerism (Structural and Stereo)", "Fundamental concepts in organic mechanisms (Inductive, Electromeric, Resonance)", "Purification and qualitative analysis of organic compounds"]},
            {"chapter_number": 9, "chapter_name": "Hydrocarbons", "topics": ["Alkanes (Structure, Nomenclature, Chemical reactions)", "Alkenes (Geometrical isomerism, Markovnikov rule)", "Alkynes (Acidic character, Polymerisation)", "Aromatic Hydrocarbons (Benzene structure, Electrophilic substitution)"]}
        ]
    },
    {
        "grade": "11th Grade",
        "subject": "Biology",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "The Living World", "topics": ["What is Living? & Biodiversity", "Taxonomic categories & Hierarchy", "Botanical Gardens, Zoological Parks, Herbaria"]},
            {"chapter_number": 2, "chapter_name": "Biological Classification", "topics": ["Five Kingdom classification", "Monera, Protista and Fungi", "Viruses, Viroids, Lichens"]},
            {"chapter_number": 3, "chapter_name": "Plant Kingdom", "topics": ["Algae, Bryophytes, Pteridophytes", "Gymnosperms & Angiosperms life cycles"]},
            {"chapter_number": 4, "chapter_name": "Animal Kingdom", "topics": ["Basis of classification", "Non-chordata phyla", "Chordata classification & classes"]},
            {"chapter_number": 5, "chapter_name": "Morphology of Flowering Plants", "topics": ["Morphology of Root, Stem, Leaf", "Inflorescence, Flower, Fruit and Seed", "Semi-technical description of families"]},
            {"chapter_number": 6, "chapter_name": "Anatomy of Flowering Plants", "topics": ["Meristematic and Permanent Tissues", "Anatomy of Dicot & Monicot root, stem, leaf", "Secondary growth"]},
            {"chapter_number": 7, "chapter_name": "Structural Organisation in Animals", "topics": ["Animal Tissues type and functions", "Morphology & Anatomy of Cockroach/Frog/Earthworm"]},
            {"chapter_number": 8, "chapter_name": "Cell: The Unit of Life", "topics": ["Cell Theory", "Prokaryotic vs Eukaryotic Cells", "Structure of Cell organelles (Mitochondria, Golgi, Plastids, Nucleus)"]},
            {"chapter_number": 9, "chapter_name": "Biomolecules", "topics": ["Structure of Carbohydrates, Proteins, Nucleic Acids & Lipids", "Enzymes properties, factors affecting & nomenclature"]},
            {"chapter_number": 10, "chapter_name": "Cell Cycle and Cell Division", "topics": ["Cell Cycle phases (Interphase)", "Mitosis phases and significance", "Meiosis phases and significance"]},
            {"chapter_number": 11, "chapter_name": "Photosynthesis in Higher Plants", "topics": ["Site of Photosynthesis & pigments", "Light Reaction (Cyclic & Non-cyclic)", "Dark Reaction (C3 and C4 pathways)", "Photorespiration"]},
            {"chapter_number": 12, "chapter_name": "Respiration in Plants", "topics": ["Glycolysis pathway", "TCA Cycle (Krebs Cycle)", "Electron Transport System (ETS) & Oxidative Phosphorylation"]},
            {"chapter_number": 13, "chapter_name": "Plant Growth and Development", "topics": ["Plant Growth regulators (Auxins, Gibberellins, Cytokinins, Ethylene)", "Photoperiodism & Vernalisation"]},
            {"chapter_number": 14, "chapter_name": "Breathing and Exchange of Gases", "topics": ["Human Respiratory Organs", "Mechanism of Breathing & Lung Volumes", "Exchange and transport of oxygen and carbon dioxide", "Regulation of Respiration"]},
            {"chapter_number": 15, "chapter_name": "Body Fluids and Circulation", "topics": ["Blood composition & Lymph", "Human Circulatory System (Heart structure, Cardiac Cycle)", "Electrocardiogram (ECG) & Double Circulation"]},
            {"chapter_number": 16, "chapter_name": "Excretory Products and Their Elimination", "topics": ["Human Excretory System & Nephron", "Urine formation & counter-current mechanism", "Regulation of Kidney function & Micturition"]},
            {"chapter_number": 17, "chapter_name": "Locomotion and Movement", "topics": ["Skeletal muscle structure & contraction theory", "Skeletal System & Joints type (Fibrous, Cartilaginous, Synovial)"]},
            {"chapter_number": 18, "chapter_name": "Neural Control and Coordination", "topics": ["Neuron structure & Nerve impulse conduction", "Central Nervous System (Brain and Spinal Cord)", "Reflex Action & Sensory Reception (Eye, Ear)"]},
            {"chapter_number": 19, "chapter_name": "Chemical Coordination and Integration", "topics": ["Endocrine glands and Hormones", "Mechanism of hormone action"]}
        ]
    },
    # ========================== CLASS 12 ==========================
    {
        "grade": "12th Grade",
        "subject": "Mathematics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Relations and Functions", "topics": ["Types of Relations (Reflexive, Symmetric, Transitive, Equivalence)", "One-one and Onto Functions", "Composite Functions & Inverse of a function"]},
            {"chapter_number": 2, "chapter_name": "Inverse Trigonometric Functions", "topics": ["Definition and Principal Value Branches", "Graphs of Inverse Trigonometric Functions", "Properties of Inverse Trigonometric Functions"]},
            {"chapter_number": 3, "chapter_name": "Matrices", "topics": ["Types of Matrices & Operations", "Transpose and Symmetric/Skew Symmetric Matrices", "Elementary operations & Inverse of matrix"]},
            {"chapter_number": 4, "chapter_name": "Determinants", "topics": ["Properties of Determinants", "Minors and Cofactors", "Adjoint and Inverse of a Square Matrix", "Solving system of linear equations using matrix method"]},
            {"chapter_number": 5, "chapter_name": "Continuity and Differentiability", "topics": ["Continuity definition and algebra", "Differentiability of composite/implicit functions", "Exponential and Logarithmic functions differentiation", "Mean Value Theorem (Rolle's & Lagrange's)"]},
            {"chapter_number": 6, "chapter_name": "Application of Derivatives", "topics": ["Rate of change of quantities", "Increasing and Decreasing Functions", "Tangents and Normals", "Maxima and Minima"]},
            {"chapter_number": 7, "chapter_name": "Integrals", "topics": ["Integration as inverse of differentiation", "Methods of Integration (Substitution, Partial Fractions, Parts)", "Definite Integrals and Fundamental Theorem of Calculus"]},
            {"chapter_number": 8, "chapter_name": "Application of Integrals", "topics": ["Area under simple curves (lines, circles, parabolas, ellipses)"]},
            {"chapter_number": 9, "chapter_name": "Differential Equations", "topics": ["Order and Degree of differential equation", "General and Particular solutions", "Homogeneous & Linear differential equations"]},
            {"chapter_number": 10, "chapter_name": "Vector Algebra", "topics": ["Types of Vectors & operations", "Direction Cosines and Direction Ratios", "Scalar and Vector Products (Dot & Cross product)"]},
            {"chapter_number": 11, "chapter_name": "Three Dimensional Geometry", "topics": ["Direction cosines & ratios of line", "Equation of a line in space", "Shortest distance between two lines", "Equation of a plane"]},
            {"chapter_number": 12, "chapter_name": "Linear Programming", "topics": ["Linear Programming Problem formulation", "Graphical method of solving LPP (Feasible region)"]},
            {"chapter_number": 13, "chapter_name": "Probability", "topics": ["Conditional Probability & Multiplication Theorem", "Bayes' Theorem", "Random Variables & Probability Distributions", "Bernoulli trials & Binomial Distribution"]}
        ]
    },
    {
        "grade": "12th Grade",
        "subject": "Physics",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Electric Charges and Fields", "topics": ["Coulomb's Law & Superposition", "Electric Field & Electric Dipole", "Electric Flux & Gauss's Law applications"]},
            {"chapter_number": 2, "chapter_name": "Electrostatic Potential and Capacitance", "topics": ["Electrostatic Potential & Equipotential surfaces", "Capacitors and Capacitance", "Energy stored in capacitor & Dielectrics"]},
            {"chapter_number": 3, "chapter_name": "Current Electricity", "topics": ["Ohm's Law, Drift Velocity & Mobility", "Resistivity dependency on temperature", "Kirchhoff's Rules & Wheatstone Bridge", "Potentiometer"]},
            {"chapter_number": 4, "chapter_name": "Moving Charges and Magnetism", "topics": ["Magnetic force on moving charge (Lorentz force)", "Biot-Savart Law & Ampere's Circuital Law", "Moving Coil Galvanometer", "Cyclotron"]},
            {"chapter_number": 5, "chapter_name": "Magnetism and Matter", "topics": ["Bar Magnet properties & field lines", "Earth's Magnetic Field & magnetic elements", "Magnetic properties of materials (Para, Dia, Ferro)"]},
            {"chapter_number": 6, "chapter_name": "Electromagnetic Induction", "topics": ["Faraday's Laws & Lenz's Law", "Motional Electromotive Force (EMF)", "Self and Mutual Inductance"]},
            {"chapter_number": 7, "chapter_name": "Alternating Current", "topics": ["AC voltage applied to LCR series circuit", "Resonance in LCR circuits & Q-factor", "Power in AC Circuits & Wattless current", "Transformers and AC Generator"]},
            {"chapter_number": 8, "chapter_name": "Electromagnetic Waves", "topics": ["Displacement Current", "Electromagnetic Waves source & properties", "Electromagnetic Spectrum"]},
            {"chapter_number": 9, "chapter_name": "Ray Optics and Optical Instruments", "topics": ["Reflection, Refraction & Total Internal Reflection", "Spherical Lenses, Lens Maker's Formula & Power", "Refraction through a Prism & dispersion", "Microscopes and Astronomical Telescopes"]},
            {"chapter_number": 10, "chapter_name": "Wave Optics", "topics": ["Huygens Principle & Wavefronts", "Coherent sources & Young's Double Slit Experiment (Interference)", "Diffraction at single slit & Polarisation"]},
            {"chapter_number": 11, "chapter_name": "Dual Nature of Radiation and Matter", "topics": ["Photoelectric Effect & Einstein's Photoelectric Equation", "Matter Waves & de Broglie Relation", "Davisson-Germer Experiment"]},
            {"chapter_number": 12, "chapter_name": "Atoms", "topics": ["Alpha particle scattering & Rutherford's model", "Bohr Model of Hydrogen Atom & Line Spectra"]},
            {"chapter_number": 13, "chapter_name": "Nuclei", "topics": ["Size and density of nucleus", "Mass energy equivalence & binding energy curve", "Radioactivity (alpha, beta, gamma decay) & Half life", "Nuclear Fission and Nuclear Fusion"]},
            {"chapter_number": 14, "chapter_name": "Semiconductor Electronics: Materials, Devices and Simple Circuits", "topics": ["Energy bands in solids (Conductors, Semiconductors, Insulators)", "Intrinsic and Extrinsic Semiconductors (n-type, p-type)", "p-n Junction Diode (Forward/Reverse bias, Rectifier)", "Logic Gates (AND, OR, NOT, NAND, NOR)"]}
        ]
    },
    {
        "grade": "12th Grade",
        "subject": "Chemistry",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Solutions", "topics": ["Types of Solutions & concentration expression", "Solubility of gases in liquids (Henry's Law)", "Raoult's Law & Ideal/Non-ideal solutions", "Colligative Properties & van 't Hoff factor"]},
            {"chapter_number": 2, "chapter_name": "Electrochemistry", "topics": ["Galvanic Cells & Nernst Equation", "Conductance in electrolytic solutions", "Kohlrausch Law", "Electrolysis & Battery types (Primary/Secondary, Fuel cells)"]},
            {"chapter_number": 3, "chapter_name": "Chemical Kinetics", "topics": ["Rate of Chemical Reaction", "Order and Molecularity of reaction", "Integrated Rate Equations (Zero & First order)", "Collision Theory & Arrhenius Equation"]},
            {"chapter_number": 4, "chapter_name": "d and f Block Elements", "topics": ["General properties of transition elements (d-block)", "Lanthanoids & Actinoids properties", "Preparation and properties of K2Cr2O7 and KMnO4"]},
            {"chapter_number": 5, "chapter_name": "Coordination Compounds", "topics": ["Werner's Theory & Nomenclature", "Isomerism in Coordination compounds", "Valence Bond Theory & Crystal Field Theory (CFT)"]},
            {"chapter_number": 6, "chapter_name": "Haloalkanes and Haloarenes", "topics": ["Nomenclature and physical properties", "Nucleophilic substitution mechanisms (SN1 & SN2)", "Electrophilic substitution in haloarenes", "Polyhalogen compounds"]},
            {"chapter_number": 7, "chapter_name": "Alcohols, Phenols and Ethers", "topics": ["Preparation of Alcohols and Phenols", "Chemical properties (Acidity of phenols, dehydration of alcohols)", "Ethers preparation & reactions"]},
            {"chapter_number": 8, "chapter_name": "Aldehydes, Ketones and Carboxylic Acids", "topics": ["Preparation methods of carbonyls", "Nucleophilic addition reactions", "Chemical properties & acidity of carboxylic acids"]},
            {"chapter_number": 9, "chapter_name": "Amines", "topics": ["Preparation & Basicity of Amines", "Chemical reactions & distinction tests", "Diazonium Salts synthesis & chemical applications"]},
            {"chapter_number": 10, "chapter_name": "Biomolecules", "topics": ["Carbohydrates classification & Glucose structure", "Proteins (Amino acids, Peptide bond, denaturation)", "Nucleic Acids structure (DNA, RNA)", "Vitamins classification"]}
        ]
    },
    {
        "grade": "12th Grade",
        "subject": "Biology",
        "chapters": [
            {"chapter_number": 1, "chapter_name": "Sexual Reproduction in Flowering Plants", "topics": ["Microsporogenesis and Megasporogenesis", "Pollination types, agents, outbreeding devices", "Double Fertilisation & Endosperm development", "Apomixis and Polyembryony"]},
            {"chapter_number": 2, "chapter_name": "Human Reproduction", "topics": ["Male and Female Reproductive Systems", "Gametogenesis (Spermatogenesis & Oogenesis)", "Menstrual Cycle & Fertilisation", "Pregnancy, Embryonic Development and Parturition"]},
            {"chapter_number": 3, "chapter_name": "Reproductive Health", "topics": ["Problems and strategies", "Population explosion and birth control methods", "Sexually Transmitted Diseases (STDs) & Infertility (ART)"]},
            {"chapter_number": 4, "chapter_name": "Principles of Inheritance and Variation", "topics": ["Mendelian inheritance laws", "Deviations from Mendelism (Incomplete dominance, Co-dominance, Linkage)", "Sex Determination in humans, birds, honeybees", "Genetic Disorders (Chromosomal and Mendelian)"]},
            {"chapter_number": 5, "chapter_name": "Molecular Basis of Inheritance", "topics": ["DNA structure & Packaging", "Search for genetic material (Griffith, Hershey-Chase)", "DNA Replication, Transcription, Translation", "Lac Operon & Human Genome Project", "DNA Fingerprinting"]},
            {"chapter_number": 6, "chapter_name": "Evolution", "topics": ["Origin of Life & biological evolution theories", "Evidences of evolution (Homology/Analogy)", "Hardy-Weinberg Principle & Adaptive Radiation", "Origin and evolution of man"]},
            {"chapter_number": 7, "chapter_name": "Human Health and Disease", "topics": ["Pathogens and diseases (Malaria, Typhoid, Pneumonia, Amoebiasis)", "Basic Immunity concepts (Active, Passive, Vaccines)", "AIDS, Cancer & Drug/Alcohol abuse"]},
            {"chapter_number": 8, "chapter_name": "Microbes in Human Welfare", "topics": ["Microbes in household and industrial products", "Sewage treatment & Biogas production", "Microbes as Biocontrol Agents and Biofertilisers"]},
            {"chapter_number": 9, "chapter_name": "Biotechnology: Principles and Processes", "topics": ["Recombinant DNA technology tools (Restriction enzymes)", "Vector cloning details", "Polymerase Chain Reaction (PCR) & Downstream processing"]},
            {"chapter_number": 10, "chapter_name": "Biotechnology and its Applications", "topics": ["Biotech in Agriculture (Bt Cotton, RNA interference)", "Medicine (Insulin, Gene Therapy, Molecular Diagnosis)", "Transgenic Animals & Ethical Issues"]},
            {"chapter_number": 11, "chapter_name": "Organisms and Populations", "topics": ["Organism and its environment (Abiotic factors)", "Population attributes (Birth/Death rates, Age pyramids)", "Population Growth models & species interactions"]},
            {"chapter_number": 12, "chapter_name": "Ecosystem", "topics": ["Ecosystem structure and function", "Productivity & Decomposition", "Energy Flow & Ecological Pyramids", "Nutrient cycling (Carbon, Phosphorus) & Ecological Succession"]},
            {"chapter_number": 13, "chapter_name": "Biodiversity and Conservation", "topics": ["Patterns of Biodiversity & Importance", "Loss of Biodiversity causes", "In-situ (Sanctuaries, Parks) & Ex-situ (Zoos, seed banks) conservation"]}
        ]
    }
]

async def seed_database():
    print(f"Connecting to MongoDB at {MONGODB_URL}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    collection = db["syllabus"]
    
    # Clear existing syllabus items to prevent duplicates
    print("Clearing existing syllabus items...")
    await collection.delete_many({})
    
    # Insert new NCERT data
    print(f"Inserting {len(SYLLABUS_DATA)} subject syllabus items...")
    result = await collection.insert_many(SYLLABUS_DATA)
    
    print(f"Successfully seeded database! Inserted IDs count: {len(result.inserted_ids)}")
    
    # Simple check query
    count = await collection.count_documents({})
    print(f"Verified total documents in 'syllabus' collection: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
