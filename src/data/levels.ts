import { LevelDefinition } from '../types/game';

/**
 * Legend for layout strings:
 * '.' = tanah_biasa (normal soil, untilled)
 * '~' = tanah_biasa (pre-tilled soil)
 * 'M' = lumpur (mud - slows vehicle & costs 2x fuel)
 * 'R' = batu (rock obstacle - impassable)
 * '=' = jalan (paved road - 0.5x fuel cost & fast speed bonus)
 * 'F' = pom_bensin (fuel station)
 * 'W' = gudang (warehouse)
 * 'B' = bengkel (repair workshop)
 */
export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    stage: 'Tahap Awal',
    title: 'Level 1: Bajak & Tanam Perdana',
    subtitle: 'Dasar pemrograman Python: tractor.move_forward(), tractor.till(), dan tractor.plant("carrot").',
    description:
      'Selamat datang di AgroCode! Kendalikan satu traktor menggunakan kode Python untuk membajak 4 petak tanah di depannya dan menanam bibit wortel ("carrot").',
    learningFocus: ['tractor.move_forward(1)', 'tractor.till()', 'tractor.plant("carrot")'],
    gridWidth: 5,
    gridHeight: 5,
    layout: [
      '=====',
      '.....',
      '.....',
      '.....',
      'F===W',
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor T-100',
        role: 'traktor',
        x: 0,
        z: 2,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'bajak',
        maxCargo: 10,
        seeds: { wortel: 20, gandum: 10, jagung: 5 },
      },
    ],
    objective: {
      description: 'Bajak minimal 4 petak tanah dan tanam 4 bibit wortel ("carrot").',
      targetTilledCount: 4,
      targetPlantedCount: 4,
    },
    starThresholds: {
      threeStarsTicks: 18,
      twoStarsTicks: 28,
      threeStarsFuel: 25,
    },
    starterCode: `# Level 1: Till and plant 4 tiles along the middle row
# Use a Python for-loop to automate the tractor

for step in range(4):
    tractor.till()
    tractor.plant("carrot")
    tractor.move_forward(1)
`,
    solutionCode: `for step in range(4):
    tractor.till()
    tractor.plant("carrot")
    tractor.move_forward(1)
`,
    hints: [
      'Call tractor.till() first before calling tractor.plant("carrot").',
      'Use tractor.move_forward(1) to advance to the next tile to the east.',
    ],
  },
  {
    id: 2,
    stage: 'Tahap Awal',
    title: 'Level 2: Siklus Panen Baris',
    subtitle: 'Menggunakan perulangan for dan kondisi if is_crop_ready(): untuk memanen.',
    description:
      'Di lahan ini sudah terdapat barisan tanaman wortel yang siap dipanen. Gunakan perulangan for dan fungsi sensor is_crop_ready() untuk memanen 5 tanaman.',
    learningFocus: ['for i in range(n):', 'is_crop_ready()', 'tractor.harvest()'],
    gridWidth: 6,
    gridHeight: 5,
    layout: [
      '======',
      '~~~~~~',
      '~~~~~~',
      '......',
      'F====W',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 2, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 2, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor T-100',
        role: 'traktor',
        x: 0,
        z: 1,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 15,
        seeds: { wortel: 20, gandum: 10, jagung: 5 },
      },
    ],
    objective: {
      description: 'Panen minimal 5 tanaman wortel yang sudah matang.',
      targetHarvestTotal: 5,
    },
    starThresholds: {
      threeStarsTicks: 15,
      twoStarsTicks: 24,
      threeStarsFuel: 20,
    },
    starterCode: `# Level 2: Move along the row and harvest mature crops
for i in range(5):
    tractor.move_forward(1)
    if is_crop_ready():
        tractor.harvest()
`,
    solutionCode: `for i in range(5):
    tractor.move_forward(1)
    if is_crop_ready():
        tractor.harvest()
`,
    hints: [
      'Use if is_crop_ready(): before calling tractor.harvest().',
      'There are 5 mature carrot crops lined up from (1, 1) to (5, 1).',
    ],
  },
  {
    id: 3,
    stage: 'Tahap Awal',
    title: 'Level 3: Manajemen Bahan Bakar Solar',
    subtitle: 'Setiap gerakan mengurangi solar. Periksa tractor.fuel dan isi ulang dengan tractor.refuel().',
    description:
      'Berbeda dengan drone, traktor darat membutuhkan solar untuk bergerak dan memanen. Tangki solar awal traktor tinggal sedikit (22%). Periksa if tractor.fuel < 25: dan isi ulang di Fuel Station!',
    learningFocus: ['tractor.fuel', 'tractor.go_to_fuel_station()', 'tractor.refuel()'],
    gridWidth: 6,
    gridHeight: 6,
    layout: [
      'F=====',
      '.~~~~~',
      '.~~~~~',
      '......',
      '......',
      'B====W',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor T-100',
        role: 'traktor',
        x: 0,
        z: 1,
        direction: 'timur',
        fuel: 22,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 15,
        seeds: { wortel: 20, gandum: 20, jagung: 5 },
      },
    ],
    objective: {
      description: 'Isi ulang solar di Pom Bensin dan panen minimal 5 gandum ("wheat") tanpa kehabisan solar.',
      targetHarvestTotal: 5,
    },
    starThresholds: {
      threeStarsTicks: 22,
      twoStarsTicks: 34,
      threeStarsFuel: 38,
    },
    starterCode: `# Level 3: Initial diesel fuel is only 22%!
# If fuel < 25, refuel at the Fuel Station first.

if tractor.fuel < 25:
    tractor.go_to_fuel_station()
    tractor.refuel()

# Return to the wheat row (z = 1) and harvest 5 crops
tractor.move_to(1, 1)
tractor.face("east")
for i in range(5):
    if is_crop_ready():
        tractor.harvest()
    if i < 4:
        tractor.move_forward(1)
`,
    solutionCode: `if tractor.fuel < 25:
    tractor.go_to_fuel_station()
    tractor.refuel()

tractor.move_to(1, 1)
tractor.face("east")
for i in range(5):
    if is_crop_ready():
        tractor.harvest()
    if i < 4:
        tractor.move_forward(1)
`,
    hints: [
      'Call tractor.go_to_fuel_station() and tractor.refuel() when tractor.fuel < 25.',
      'Use tractor.move_to(1, 1) to navigate back to the start of the wheat row.',
    ],
  },
  {
    id: 4,
    stage: 'Tahap Menengah',
    title: 'Level 4: Pergantian Implement (Alat Tempel)',
    subtitle: 'Traktor harus memasang "plow", "seeder", atau "harvester" sebelum bekerja.',
    description:
      'Setiap pergantian alat tempel membutuhkan waktu tick dan solar. Agar efisien, jangan mengganti alat di setiap petak! Pasang "plow" untuk seluruh baris, lalu ganti ke "seeder", dan terakhir pasang "harvester".',
    learningFocus: ['tractor.equip("plow")', 'tractor.equip("seeder")', 'tractor.equip("harvester")'],
    gridWidth: 6,
    gridHeight: 5,
    layout: [
      'F====W',
      '......',
      '......',
      '......',
      'B=====',
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor Multi-Implement',
        role: 'traktor',
        x: 1,
        z: 2,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'kosong',
        maxCargo: 15,
        seeds: { wortel: 25, gandum: 15, jagung: 10 },
      },
    ],
    objective: {
      description: 'Bajak 4 petak, tanam 4 bibit, dan panen minimal 4 hasil panen.',
      targetTilledCount: 4,
      targetPlantedCount: 4,
      targetHarvestTotal: 4,
    },
    starThresholds: {
      threeStarsTicks: 32,
      twoStarsTicks: 45,
      threeStarsFuel: 45,
    },
    starterCode: `# Level 4: Implement Attachment Efficiency
# 1. Equip "plow" and till 4 tiles
tractor.equip("plow")
for i in range(4):
    tractor.till()
    if i < 3:
        tractor.move_forward(1)

# 2. Equip "seeder" and plant carrots while moving west
tractor.equip("seeder")
tractor.face("west")
for i in range(4):
    tractor.plant("carrot")
    if i < 3:
        tractor.move_forward(1)

# 3. Equip "harvester" and harvest along the row to the east
tractor.equip("harvester")
tractor.face("east")
for i in range(4):
    tractor.wait_until_ripe()
    tractor.harvest()
    if i < 3:
        tractor.move_forward(1)
`,
    solutionCode: `tractor.equip("plow")
for i in range(4):
    tractor.till()
    if i < 3:
        tractor.move_forward(1)

tractor.equip("seeder")
tractor.face("west")
for i in range(4):
    tractor.plant("carrot")
    if i < 3:
        tractor.move_forward(1)

tractor.equip("harvester")
tractor.face("east")
for i in range(4):
    tractor.wait_until_ripe()
    tractor.harvest()
    if i < 3:
        tractor.move_forward(1)
`,
    hints: [
      'Switching implements only 3 times for the whole row is much faster than switching on every tile.',
      'tractor.wait_until_ripe() waits for the crop on the current tile to reach 100% maturity.',
    ],
  },
  {
    id: 5,
    stage: 'Tahap Menengah',
    title: 'Level 5: Medan Berlumpur vs Jalan Raya',
    subtitle: 'Tanah berlumpur memperlambat kendaraan & boros solar; jalan memberi bonus kecepatan.',
    description:
      'Bagian tengah ladang tertutup lumpur tebal (M) yang menguras solar 2x lipat. Gunakan jalur Jalan Raya (=) di tepi utara untuk mencapai ladang gandum di sisi timur dengan hemat bahan bakar!',
    learningFocus: ['Mud vs Road Terrain', 'Route Optimization', 'Fuel Budget Constraint'],
    gridWidth: 7,
    gridHeight: 6,
    layout: [
      'F======',
      '.MMMM~~',
      '.MMMM~~',
      '.MMMM~~',
      '.......',
      'B=====W',
    ],
    initialCrops: [
      { x: 5, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 6, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 6, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 3, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 6, z: 3, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor T-200',
        role: 'traktor',
        x: 0,
        z: 2,
        direction: 'utara',
        fuel: 40,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 15,
        seeds: { wortel: 10, gandum: 20, jagung: 10 },
      },
    ],
    objective: {
      description: 'Panen minimal 5 gandum di seberang lumpur dengan konsumsi solar maksimal 25L.',
      targetHarvestTotal: 5,
      maxFuelUsed: 25,
    },
    starThresholds: {
      threeStarsTicks: 20,
      twoStarsTicks: 30,
      threeStarsFuel: 18,
    },
    starterCode: `# Level 5: Avoid the mud in the center! Take the paved road at z = 0
tractor.face("north")
tractor.move_forward(2)
tractor.turn_right()
tractor.move_forward(5)
tractor.turn_right()

# Now harvest wheat in columns x = 5 and x = 6
for row in range(3):
    tractor.move_forward(1)
    tractor.harvest()
    tractor.face("east")
    tractor.move_forward(1)
    tractor.harvest()
    tractor.face("west")
    tractor.move_forward(1)
    tractor.face("south")
`,
    solutionCode: `tractor.face("north")
tractor.move_forward(2)
tractor.turn_right()
tractor.move_forward(5)
tractor.turn_right()

for row in range(3):
    tractor.move_forward(1)
    tractor.harvest()
    tractor.face("east")
    tractor.move_forward(1)
    tractor.harvest()
    tractor.face("west")
    tractor.move_forward(1)
    tractor.face("south")
`,
    hints: [
      'The paved road along the top row (z = 0) only costs 0.5L of fuel per step.',
      'Crossing mud tiles (M) costs 3.0L per step and will drain the tank before you finish.',
    ],
  },
  {
    id: 6,
    stage: 'Tahap Menengah',
    title: 'Level 6: Rintangan Batu & Sensor Tanah',
    subtitle: 'Batu menghalangi jalan. Gunakan inspect_ground() dan tractor.move_to(x, y) untuk menghindarinya.',
    description:
      'Ladang ini memiliki bongkahan batu granit (R) yang tidak bisa ditembus traktor. Gunakan daftar koordinat dan tractor.move_to(x, y) untuk memanen seluruh jagung tanpa menabrak batu!',
    learningFocus: ['inspect_ground()', 'tractor.inspect_front()', 'tractor.move_to(x, y)'],
    gridWidth: 7,
    gridHeight: 6,
    layout: [
      'F=====W',
      '~R~~~R~',
      '~~~R~~~',
      '~R~~~R~',
      '.......',
      'B======',
    ],
    initialCrops: [
      { x: 0, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor Sensor VE01',
        role: 'traktor',
        x: 0,
        z: 1,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 20,
        seeds: { wortel: 10, gandum: 10, jagung: 20 },
      },
    ],
    objective: {
      description: 'Panen minimal 6 jagung ("corn") tanpa menabrak batu penghalang.',
      targetHarvestTotal: 6,
    },
    starThresholds: {
      threeStarsTicks: 24,
      twoStarsTicks: 36,
      threeStarsFuel: 30,
    },
    starterCode: `# Level 6: Navigate around rock obstacles using target coordinates
target_tiles = [(0, 1), (1, 2), (2, 2), (2, 1), (3, 1), (4, 1), (4, 2)]

for pos in target_tiles:
    tractor.move_to(pos[0], pos[1])
    if is_crop_ready():
        tractor.harvest()
`,
    solutionCode: `target_tiles = [(0, 1), (1, 2), (2, 2), (2, 1), (3, 1), (4, 1), (4, 2)]

for pos in target_tiles:
    tractor.move_to(pos[0], pos[1])
    if is_crop_ready():
        tractor.harvest()
`,
    hints: [
      'tractor.move_to(x, y) automatically computes the shortest obstacle-free path around rocks (R).',
      'You can also check tractor.inspect_front() != "rock" before calling tractor.move_forward(1).',
    ],
  },
  {
    id: 7,
    stage: 'Tahap Menengah',
    title: 'Level 7: Perawatan Mesin & Bengkel',
    subtitle: 'Kendaraan bisa aus dan rusak. Periksa tractor.condition dan perbaiki dengan tractor.repair().',
    description:
      'Traktor ini telah bekerja keras sehingga kondisi mesin awalnya tinggal 35%. Jika kondisi mencapai 0%, traktor akan mogok! Periksa if tractor.condition < 50: dan kunjungi Workshop (B) sebelum memanen.',
    learningFocus: ['tractor.condition', 'get_status()', 'tractor.go_to_workshop()', 'tractor.repair()'],
    gridWidth: 7,
    gridHeight: 6,
    layout: [
      'F=====W',
      '.~~~~~.',
      '.~~~~~.',
      '.......',
      'B======',
      '=======',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 2, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 2, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 2, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor Veteran VE01',
        role: 'traktor',
        x: 0,
        z: 3,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 20,
        seeds: { wortel: 20, gandum: 10, jagung: 10 },
      },
    ],
    objective: {
      description: 'Perbaiki traktor di Bengkel (Workshop) dan panen minimal 6 wortel.',
      targetHarvestTotal: 6,
    },
    starThresholds: {
      threeStarsTicks: 24,
      twoStarsTicks: 36,
      threeStarsFuel: 32,
    },
    starterCode: `# Level 7: Check machine condition before heavy harvesting
info = get_status()
if tractor.condition < 50:
    tractor.go_to_workshop()
    tractor.repair()

# Once condition is 100%, harvest the carrot rows
tractor.move_to(1, 1)
tractor.face("east")
for i in range(5):
    tractor.harvest()
    if i < 4:
        tractor.move_forward(1)

tractor.move_to(3, 2)
tractor.harvest()
`,
    solutionCode: `if tractor.condition < 50:
    tractor.go_to_workshop()
    tractor.repair()

tractor.move_to(1, 1)
tractor.face("east")
for i in range(5):
    tractor.harvest()
    if i < 4:
        tractor.move_forward(1)

tractor.move_to(3, 2)
tractor.harvest()
`,
    hints: [
      'Call tractor.go_to_workshop() followed by tractor.repair() to restore engine and implement condition to 100%.',
    ],
  },
  {
    id: 8,
    stage: 'Tahap Akhir',
    title: 'Level 8: Kapasitas Tangki & Logistik Gudang',
    subtitle: 'Hasil panen harus dibawa ke Gudang saat kapasitas tangki penuh (tractor.cargo >= tractor.capacity).',
    description:
      'Kapasitas tangki panen kendaraan ini hanya muat 4 tanaman! Jika tangki penuh, kendaraan tidak bisa memanen lagi sebelum menyetor hasil panen ke Warehouse (W) dengan perintah deliver_to_warehouse().',
    learningFocus: ['tractor.cargo', 'tractor.capacity', 'tractor.deliver_to_warehouse()'],
    gridWidth: 7,
    gridHeight: 6,
    layout: [
      'F=====W',
      '.~~~~~.',
      '.~~~~~.',
      '.~~~~~.',
      '.......',
      'B======',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 1, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 2, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Combine Harvester C-80',
        role: 'pemanen',
        x: 1,
        z: 1,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 4,
        seeds: { wortel: 10, gandum: 10, jagung: 15 },
      },
    ],
    objective: {
      description: 'Panen dan kirim minimal 6 jagung ke dalam Gudang (Warehouse).',
      targetWarehouseTotal: 6,
    },
    starThresholds: {
      threeStarsTicks: 28,
      twoStarsTicks: 42,
      threeStarsFuel: 38,
    },
    starterCode: `# Level 8: Crop tank capacity is only 4! Deliver to warehouse when full.
corn_tiles = [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (3, 2)]

for pos in corn_tiles:
    tractor.move_to(pos[0], pos[1])
    tractor.harvest()
    if tractor.cargo >= tractor.capacity:
        tractor.deliver_to_warehouse()

# Deliver remaining cargo at the end
if tractor.cargo > 0:
    tractor.deliver_to_warehouse()
`,
    solutionCode: `corn_tiles = [(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (3, 2)]

for pos in corn_tiles:
    tractor.move_to(pos[0], pos[1])
    tractor.harvest()
    if tractor.cargo >= tractor.capacity:
        tractor.deliver_to_warehouse()

if tractor.cargo > 0:
    tractor.deliver_to_warehouse()
`,
    hints: [
      'tractor.deliver_to_warehouse() automatically drives to the Warehouse (W) and unloads all crops.',
      'Make sure any remaining crops after the loop are also delivered to reach 6 stored crops.',
    ],
  },
  {
    id: 9,
    stage: 'Tahap Akhir',
    title: 'Level 9: Duet Harvester & Hauler Truck',
    subtitle: 'Koordinasi 2 kendaraan: tractor memanen di ladang, hauler membawa hasil ke Gudang.',
    description:
      'Di level ini Anda mengontrol 2 kendaraan: tractor (Combine Harvester) dan hauler (Logistics Truck). Gunakan tractor.transfer_to(hauler) agar truk pengangkut yang mengantar panen ke Warehouse!',
    learningFocus: ['Multi-Vehicle Control', 'hauler.move_to(x, y)', 'tractor.transfer_to(hauler)'],
    gridWidth: 8,
    gridHeight: 6,
    layout: [
      'F======W',
      '.~~~~~~.',
      '.~~~~~~.',
      '========',
      '........',
      'B======W',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 2, crop: 'gandum', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Combine Harvester VE01',
        role: 'pemanen',
        x: 1,
        z: 1,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 6,
        seeds: { wortel: 10, gandum: 20, jagung: 10 },
      },
      {
        id: 'pengangkut',
        codeAlias: 'VE02',
        name: 'Hauler Truck VE02',
        role: 'pengangkut',
        x: 1,
        z: 3,
        direction: 'timur',
        fuel: 100,
        maxFuel: 120,
        implement: 'kosong',
        maxCargo: 16,
        seeds: { wortel: 0, gandum: 0, jagung: 0 },
      },
    ],
    objective: {
      description: 'Panen minimal 6 gandum dan kirim ke Gudang menggunakan koordinasi Tractor & Hauler.',
      targetWarehouseTotal: 6,
    },
    starThresholds: {
      threeStarsTicks: 28,
      twoStarsTicks: 42,
      threeStarsFuel: 36,
    },
    starterCode: `# Level 9: Harvester & Hauler Truck Coordination
# 1. Tractor harvests row 1 and row 2
for x in range(1, 5):
    tractor.move_to(x, 1)
    tractor.harvest()

for x in range(4, 2, -1):
    tractor.move_to(x, 2)
    tractor.harvest()

# 2. Hauler truck moves to (3, 3) adjacent to tractor to receive cargo
hauler.move_to(3, 3)
tractor.transfer_to(hauler)

# 3. Hauler delivers the harvested wheat along the paved road to Warehouse
hauler.deliver_to_warehouse()
`,
    solutionCode: `for x in range(1, 5):
    tractor.move_to(x, 1)
    tractor.harvest()

for x in range(4, 2, -1):
    tractor.move_to(x, 2)
    tractor.harvest()

hauler.move_to(3, 3)
tractor.transfer_to(hauler)
hauler.deliver_to_warehouse()
`,
    hints: [
      'Use tractor.transfer_to(hauler) when both vehicles are on adjacent tiles.',
      'The hauler truck drives along the paved road (=) for fast, low-fuel delivery to the Warehouse.',
    ],
  },
  {
    id: 10,
    stage: 'Tahap Akhir',
    title: 'Level 10: Otomasi Penuh Armada (Ujian Akhir Skripsi)',
    subtitle: '3 Kendaraan (tractor, harvester, hauler) bekerja serentak tanpa tabrakan.',
    description:
      'Tantangan puncak! Anda memprogram 3 kendaraan darat: tractor (penanam), harvester (Combine Harvester), dan hauler (Truk Logistik) di ladang besar dengan lumpur dan batu. Capai target panen & gudang tanpa tabrakan!',
    learningFocus: [
      '3-Vehicle Fleet (tractor, harvester, hauler)',
      'Zero-Collision Route Planning',
      'Maximum Fuel & Time Efficiency',
    ],
    gridWidth: 8,
    gridHeight: 7,
    layout: [
      'F======W',
      '.~~~~~~.',
      '.~~MM~~.',
      '.~~RR~~.',
      '.~~~~~~.',
      '========',
      'B======W',
    ],
    initialCrops: [
      { x: 1, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 3, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 4, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 6, z: 1, crop: 'wortel', growth: 100, soil: 'sudah_dibajak' },
      { x: 1, z: 4, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 2, z: 4, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 5, z: 4, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
      { x: 6, z: 4, crop: 'jagung', growth: 100, soil: 'sudah_dibajak' },
    ],
    vehicles: [
      {
        id: 'traktor',
        codeAlias: 'VE01',
        name: 'Tractor Seeder VE01',
        role: 'traktor',
        x: 1,
        z: 2,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'penabur',
        maxCargo: 10,
        seeds: { wortel: 20, gandum: 20, jagung: 20 },
      },
      {
        id: 'pemanen',
        codeAlias: 'VE02',
        name: 'Combine Harvester VE02',
        role: 'pemanen',
        x: 1,
        z: 1,
        direction: 'timur',
        fuel: 100,
        maxFuel: 100,
        implement: 'pemanen',
        maxCargo: 12,
        seeds: { wortel: 0, gandum: 0, jagung: 0 },
      },
      {
        id: 'pengangkut',
        codeAlias: 'VE03',
        name: 'Hauler Truck VE03',
        role: 'pengangkut',
        x: 1,
        z: 5,
        direction: 'timur',
        fuel: 100,
        maxFuel: 120,
        implement: 'kosong',
        maxCargo: 20,
        seeds: { wortel: 0, gandum: 0, jagung: 0 },
      },
    ],
    objective: {
      description: 'Tanam minimal 4 bibit baru, panen 8 tanaman, dan setor 8 hasil panen ke Gudang.',
      targetPlantedCount: 4,
      targetHarvestTotal: 8,
      targetWarehouseTotal: 8,
    },
    starThresholds: {
      threeStarsTicks: 38,
      twoStarsTicks: 55,
      threeStarsFuel: 50,
    },
    starterCode: `# Level 10: Full 3-Vehicle Fleet Automation
# 1. Harvester (VE02) harvests the northern row (z = 1)
for x in range(1, 7):
    harvester.move_to(x, 1)
    if harvester.is_crop_ready():
        harvester.harvest()

# 2. Tractor (VE01) replants carrots along the harvested northern row
for x in range(1, 5):
    tractor.move_to(x, 1)
    tractor.plant("carrot")

# 3. Harvester harvests corn in the southern row (z = 4) and transfers to Hauler
harvester.move_to(5, 4)
harvester.harvest()
harvester.move_to(6, 4)
harvester.harvest()

hauler.move_to(6, 5)
harvester.transfer_to(hauler)
hauler.deliver_to_warehouse()
`,
    solutionCode: `for x in range(1, 7):
    harvester.move_to(x, 1)
    if harvester.is_crop_ready():
        harvester.harvest()

for x in range(1, 5):
    tractor.move_to(x, 1)
    tractor.plant("carrot")

harvester.move_to(5, 4)
harvester.harvest()
harvester.move_to(6, 4)
harvester.harvest()

hauler.move_to(6, 5)
harvester.transfer_to(hauler)
hauler.deliver_to_warehouse()
`,
    hints: [
      'You control 3 vehicle objects in Python: tractor (VE01), harvester (VE02), and hauler (VE03).',
      'Ensure two vehicles never occupy the same (x, z) tile simultaneously.',
    ],
  },
];
