// ============================================================
// Static reference data: zones, blocks, scoring rules, mascots.
// Everything that changes (events, leaderboard, zone status, activity) comes from the server, see store.js.
// ============================================================

export const MAP_CENTER = [40.4535, -80.0030];
export const MAP_ZOOM = 15;
// OSM France works with or without a Referer; the main OSM server is the fallback (see map.js).
export const TILE_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
export const TILE_URL_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const SCORING = {
  pointsPerMinute: 2, // base points earned per minute cleaned
  minimumPoints: 10, // floor for any completed session
};

export const ADOPTION_RULES = {
  commitment: 'Once per week minimum',
  term: '3 months (renewable)',
  pointsMultiplier: 2,
  streakBonus: 100,
  adoptionBadge: '🏠 Block Adopter',
  promptAfterCheckins: 3,
};

// Rotate these weekly to steer volunteers where they're needed most.
export const HOT_SPOTS = {
  hottest: { ids: ['z2'], multiplier: 3, label: 'Hottest block', short: '3× pts' },
  hot: { ids: ['z3', 'z6'], multiplier: 2, label: 'Hot block', short: '2× pts' },
};

export function getHotSpot(id) {
  if (!id) return null;
  if (HOT_SPOTS.hottest.ids.includes(id)) return HOT_SPOTS.hottest;
  if (HOT_SPOTS.hot.ids.includes(id)) return HOT_SPOTS.hot;
  return null;
}

export function bestHotSpot(ids) {
  let best = null;
  (ids || []).forEach((id) => {
    const h = getHotSpot(id);
    if (h && (!best || h.multiplier > best.multiplier)) best = h;
  });
  return best;
}

export const ZONES = [
  { id: 'z1', name: 'Allegheny Park', emoji: '🌿' },
  { id: 'z2', name: 'South of East Ohio', emoji: '🌳' },
  { id: 'z3', name: 'Business District', emoji: '🏬' },
  { id: 'z4', name: 'North of East Ohio', emoji: '⛲' },
  { id: 'z5', name: 'Interstate and Ramps', emoji: '🛤️' },
  { id: 'z6', name: 'Hospital', emoji: '🏥' },
  { id: 'z7', name: 'North of North St.', emoji: '🏘️' },
  { id: 'z8', name: 'East of 279', emoji: '🛣️' },
  { id: 'z9', name: 'Penn Brewery Area', emoji: '🍺' },
];

export const ZONE_POLYGONS = {
  z1: [[40.45622,-80.00266],[40.45545,-80.00661],[40.45392,-80.00610],[40.45428,-80.00423],[40.45423,-80.00414],[40.45059,-80.00290],[40.45099,-80.00091],[40.45619,-80.00263]],
  z2: [[40.45058,-80.00289],[40.45027,-80.00277],[40.45053,-80.00141],[40.44995,-80.00123],[40.44999,-80.00089],[40.45059,-80.00108],[40.45116,-79.99829],[40.45168,-79.99768],[40.45229,-79.99760],[40.45294,-79.99763],[40.45381,-79.99786],[40.45311,-80.00158],[40.45100,-80.00085],[40.45059,-80.00284]],
  z3: [[40.45418,-80.00195],[40.45319,-80.00162],[40.45376,-79.99875],[40.45388,-79.99775],[40.45491,-79.99809],[40.45420,-80.00189]],
  z4: [[40.45623,-80.00265],[40.45699,-79.99873],[40.45493,-79.99805],[40.45420,-80.00195],[40.45616,-80.00261]],
  z5: [[40.45859,-79.99951],[40.45887,-79.99828],[40.45740,-79.99775],[40.45709,-79.99769],[40.45396,-79.99667],[40.45356,-79.99633],[40.45284,-79.99760],[40.45382,-79.99786],[40.45387,-79.99772],[40.45701,-79.99874],[40.45693,-79.99908],[40.45705,-79.99913],[40.45717,-79.99903],[40.45852,-79.99949]],
  z6: [[40.45776,-80.00525],[40.45581,-80.00469],[40.45644,-80.00162],[40.45824,-80.00218],[40.45791,-80.00432]],
  z7: [[40.45825,-80.00217],[40.45854,-80.00059],[40.45846,-80.00056],[40.45839,-80.00045],[40.45829,-80.00038],[40.45822,-80.00038],[40.45810,-80.00041],[40.45676,-79.99997],[40.45644,-80.00160],[40.45821,-80.00215]],
  z8: [[40.45828,-79.99810],[40.45873,-79.99565],[40.45493,-79.99437],[40.45483,-79.99429],[40.45446,-79.99491],[40.45403,-79.99665],[40.45719,-79.99771],[40.45738,-79.99771]],
  z9: [[40.45873,-79.99565],[40.45677,-79.99114],[40.45666,-79.99106],[40.45649,-79.99136],[40.45599,-79.99107],[40.45500,-79.99221],[40.45458,-79.99266],[40.45448,-79.99277],[40.45448,-79.99286],[40.45396,-79.99349],[40.45434,-79.99392],[40.45455,-79.99405],[40.45484,-79.99428],[40.45495,-79.99436],[40.45865,-79.99562]],
};

export const BLOCKS = [
  { id:'b1_1', zoneId:'z1', name:'Allegheny Park North', polygon:[[40.45545,-80.00660],[40.45392,-80.00609],[40.45431,-80.00409],[40.45455,-80.00396],[40.45458,-80.00385],[40.45591,-80.00432],[40.45546,-80.00658]] },
  { id:'b1_2', zoneId:'z1', name:'Allegheny Park South', polygon:[[40.45309,-80.00260],[40.45325,-80.00165],[40.45101,-80.00091],[40.45059,-80.00287],[40.45100,-80.00302],[40.45124,-80.00196],[40.45305,-80.00257]] },
  { id:'b2_1', zoneId:'z2', name:'Stockton Ave', polygon:[[40.45091,-80.00123],[40.44999,-80.00092],[40.44993,-80.00121],[40.45056,-80.00142],[40.45029,-80.00278],[40.45058,-80.00290]] },
  { id:'b2_2', zoneId:'z2', name:'Giant Eagle Area', polygon:[[40.45092,-80.00120],[40.45060,-80.00110],[40.45116,-79.99835],[40.45167,-79.99772],[40.45221,-79.99763],[40.45156,-80.00103],[40.45101,-80.00084]] },
  { id:'b3_1', zoneId:'z3', name:'Allegheny Center Park North', polygon:[[40.45332,-80.00165],[40.45332,-80.00155],[40.45349,-80.00060],[40.45340,-80.00056],[40.45320,-80.00162],[40.45331,-80.00165]] },
  { id:'b3_2', zoneId:'z3', name:'Allegheny Center Park South', polygon:[] },
  { id:'b6_1', zoneId:'z6', name:'Hospital North', polygon:[[40.45776,-80.00527],[40.45755,-80.00520],[40.45803,-80.00211],[40.45825,-80.00216],[40.45776,-80.00523]] },
  { id:'b6_2', zoneId:'z6', name:'Hospital South', polygon:[[40.45600,-80.00477],[40.45581,-80.00471],[40.45644,-80.00158],[40.45666,-80.00167]] },
  { id:'b_z6_1', zoneId:'z6', name:'Hospital East', polygon:[[40.45825,-80.00216],[40.45821,-80.00244],[40.45639,-80.00188],[40.45646,-80.00158]] },
  { id:'b_z6_2', zoneId:'z6', name:'Hospital West', polygon:[[40.45776,-80.00526],[40.45781,-80.00496],[40.45589,-80.00440],[40.45582,-80.00468],[40.45772,-80.00523]] },
  { id:'b_z1_1', zoneId:'z1', name:'Fountain', polygon:[[40.45591,-80.00430],[40.45623,-80.00265],[40.45488,-80.00218],[40.45458,-80.00383]] },
  { id:'b_z1_2', zoneId:'z1', name:'Allegheny Park East', polygon:[[40.45470,-80.00315],[40.45455,-80.00311],[40.45457,-80.00306],[40.45320,-80.00262],[40.45336,-80.00169],[40.45488,-80.00218]] },
  { id:'b_z1_3', zoneId:'z1', name:'Allegheny Center', polygon:[[40.45428,-80.00416],[40.45298,-80.00371],[40.45319,-80.00263],[40.45457,-80.00305],[40.45455,-80.00311],[40.45470,-80.00317],[40.45455,-80.00395],[40.45432,-80.00406]] },
  { id:'b_z1_4', zoneId:'z1', name:'Allegheny Commons', polygon:[[40.45310,-80.00265],[40.45290,-80.00369],[40.45103,-80.00304],[40.45122,-80.00195]] },
  { id:'b_z2_1', zoneId:'z2', name:'Pressley West', polygon:[[40.45204,-79.99936],[40.45190,-79.99930],[40.45155,-80.00103],[40.45170,-80.00108]] },
  { id:'b_z2_2', zoneId:'z2', name:'Pressley East', polygon:[[40.45205,-79.99935],[40.45190,-79.99930],[40.45222,-79.99763],[40.45237,-79.99761],[40.45206,-79.99931]] },
  { id:'b_z2_3', zoneId:'z2', name:'Lockhart St.', polygon:[[40.45225,-80.00127],[40.45212,-80.00123],[40.45280,-79.99763],[40.45293,-79.99763]] },
  { id:'b_z2_4', zoneId:'z2', name:'Avery St.', polygon:[[40.45280,-80.00147],[40.45264,-80.00141],[40.45331,-79.99794],[40.45345,-79.99799],[40.45281,-80.00142]] },
  { id:'b_z2_5', zoneId:'z2', name:'Cedar Av. South', polygon:[[40.45339,-80.00157],[40.45337,-80.00183],[40.45100,-80.00101],[40.45106,-80.00074],[40.45336,-80.00154]] },
  { id:'b_z3_1', zoneId:'z3', name:'East Ohio S. - Cedar to James', polygon:[[40.45332,-80.00166],[40.45332,-80.00156],[40.45350,-80.00060],[40.45340,-80.00056],[40.45320,-80.00162],[40.45330,-80.00165]] },
  { id:'b_z3_2', zoneId:'z3', name:'East Ohio S. - James to Middle', polygon:[[40.45350,-80.00059],[40.45341,-80.00056],[40.45369,-79.99907],[40.45378,-79.99910]] },
  { id:'b_z3_3', zoneId:'z3', name:'East Ohio S. - James to East', polygon:[[40.45378,-79.99909],[40.45370,-79.99906],[40.45376,-79.99873],[40.45388,-79.99775],[40.45401,-79.99779]] },
  { id:'b_z3_4', zoneId:'z3', name:'East Ohio N. - Cedar to James', polygon:[[40.45334,-80.00166],[40.45334,-80.00155],[40.45351,-80.00059],[40.45363,-80.00064],[40.45343,-80.00168],[40.45338,-80.00166]] },
  { id:'b_z3_5', zoneId:'z3', name:'East Ohio N. - James to Middle', polygon:[[40.45362,-80.00063],[40.45352,-80.00060],[40.45378,-79.99910],[40.45389,-79.99913],[40.45363,-80.00059]] },
  { id:'b_z3_6', zoneId:'z3', name:'East Ohio N. - James to East', polygon:[[40.45388,-79.99913],[40.45379,-79.99910],[40.45401,-79.99779],[40.45413,-79.99783],[40.45389,-79.99910]] },
  { id:'b_z3_7', zoneId:'z3', name:'Foreland to James', polygon:[[40.45417,-80.00194],[40.45404,-80.00190],[40.45424,-80.00084],[40.45438,-80.00089],[40.45419,-80.00189]] },
  { id:'b_z3_8', zoneId:'z3', name:'Foreland - James to Middle', polygon:[[40.45438,-80.00089],[40.45425,-80.00084],[40.45452,-79.99936],[40.45465,-79.99940],[40.45439,-80.00081]] },
  { id:'b_z3_9', zoneId:'z3', name:'Foreland - Middle to East', polygon:[[40.45466,-79.99939],[40.45453,-79.99935],[40.45477,-79.99805],[40.45490,-79.99809],[40.45467,-79.99931]] },
  { id:'b_z3_10', zoneId:'z3', name:'Moravian St. - Foreland to East Ohio', polygon:[[40.45429,-80.00136],[40.45427,-80.00148],[40.45341,-80.00120],[40.45344,-80.00106],[40.45425,-80.00134]] },
  { id:'b_z3_11', zoneId:'z3', name:'James - Foreland to East Ohio', polygon:[[40.45437,-80.00097],[40.45440,-80.00082],[40.45355,-80.00053],[40.45352,-80.00069],[40.45434,-80.00096]] },
  { id:'b_z3_12', zoneId:'z3', name:'Middle - Foreland to East Ohio', polygon:[[40.45465,-79.99947],[40.45468,-79.99932],[40.45385,-79.99904],[40.45382,-79.99921],[40.45463,-79.99946]] },
  { id:'b_z3_13', zoneId:'z3', name:'East St. - Foreland to East Ohio', polygon:[[40.45488,-79.99824],[40.45403,-79.99795],[40.45406,-79.99781],[40.45491,-79.99808],[40.45489,-79.99819]] },
  { id:'b_z3_14', zoneId:'z3', name:'Parking Lot', polygon:[[40.45427,-80.00076],[40.45393,-80.00065],[40.45418,-79.99933],[40.45451,-79.99943],[40.45429,-80.00069]] },
  { id:'b_z4_1', zoneId:'z4', name:'Cedar Ave', polygon:[[40.45625,-80.00252],[40.45623,-80.00274],[40.45323,-80.00173],[40.45326,-80.00153],[40.45618,-80.00251]] },
  { id:'b_z4_2', zoneId:'z4', name:'Suismon - Cedar to James', polygon:[[40.45503,-80.00222],[40.45482,-80.00216],[40.45503,-80.00110],[40.45525,-80.00116],[40.45505,-80.00210]] },
  { id:'b_z4_3', zoneId:'z4', name:'Suismon - James to Middle', polygon:[[40.45524,-80.00115],[40.45503,-80.00110],[40.45532,-79.99961],[40.45551,-79.99968],[40.45525,-80.00109]] },
  { id:'b_z4_4', zoneId:'z4', name:'Suismon - Middle to East', polygon:[[40.45551,-79.99968],[40.45532,-79.99962],[40.45559,-79.99827],[40.45577,-79.99833],[40.45552,-79.99964]] },
  { id:'b_z4_5', zoneId:'z4', name:'Tripoli - Cedar to James', polygon:[[40.45581,-80.00250],[40.45562,-80.00244],[40.45583,-80.00135],[40.45605,-80.00142],[40.45584,-80.00242]] },
  { id:'b_z4_6', zoneId:'z4', name:'Tripoli - James to Middle', polygon:[[40.45603,-80.00141],[40.45584,-80.00134],[40.45611,-79.99988],[40.45633,-79.99994],[40.45606,-80.00133]] },
  { id:'b_z4_7', zoneId:'z4', name:'Tripoli - Middle to East', polygon:[[40.45632,-79.99993],[40.45613,-79.99987],[40.45636,-79.99853],[40.45657,-79.99859],[40.45633,-79.99986]] },
  { id:'b_z4_8', zoneId:'z4', name:'North - James to Middle', polygon:[[40.45659,-80.00162],[40.45638,-80.00154],[40.45662,-80.00007],[40.45690,-80.00017],[40.45660,-80.00158]] },
  { id:'b_z4_9', zoneId:'z4', name:'North - Cedar to James', polygon:[[40.45634,-80.00267],[40.45614,-80.00260],[40.45636,-80.00153],[40.45659,-80.00164],[40.45639,-80.00258]] },
  { id:'b_z4_10', zoneId:'z4', name:'North - Middle to East', polygon:[[40.45687,-80.00015],[40.45666,-80.00006],[40.45693,-79.99871],[40.45719,-79.99883],[40.45689,-80.00009]] },
  { id:'b_z4_11', zoneId:'z4', name:'Thropp - James to Middle', polygon:[[40.45558,-80.00136],[40.45542,-80.00130],[40.45574,-79.99967],[40.45590,-79.99974],[40.45561,-80.00124]] },
  { id:'b_z4_12', zoneId:'z4', name:'Thropp - Middle to East', polygon:[[40.45576,-79.99980],[40.45566,-79.99978],[40.45592,-79.99839],[40.45602,-79.99842],[40.45577,-79.99976]] },
  { id:'b_z4_13', zoneId:'z4', name:'Shawano - James to Middle', polygon:[[40.45476,-80.00111],[40.45460,-80.00106],[40.45489,-79.99939],[40.45510,-79.99946],[40.45482,-80.00098]] },
  { id:'b_z4_14', zoneId:'z4', name:'Shawano - Middle to East', polygon:[[40.45507,-79.99961],[40.45487,-79.99951],[40.45514,-79.99814],[40.45535,-79.99819],[40.45509,-79.99943]] },
  { id:'b_z4_15', zoneId:'z4', name:'James St.', polygon:[[40.45643,-80.00168],[40.45648,-80.00144],[40.45443,-80.00075],[40.45438,-80.00100],[40.45637,-80.00166]] },
  { id:'b_z4_16', zoneId:'z4', name:'Middle St.', polygon:[[40.45673,-80.00021],[40.45677,-79.99998],[40.45476,-79.99927],[40.45467,-79.99953],[40.45667,-80.00020]] },
  { id:'b_z4_17', zoneId:'z4', name:'East St.', polygon:[[40.45699,-79.99874],[40.45696,-79.99893],[40.45492,-79.99826],[40.45496,-79.99804],[40.45692,-79.99872]] },
  { id:'b_z5_1', zoneId:'z5', name:'279 South Ramp', polygon:[[40.45386,-79.99776],[40.45383,-79.99787],[40.45283,-79.99761],[40.45290,-79.99748],[40.45385,-79.99774]] },
  { id:'b_z5_2', zoneId:'z5', name:'279 North Ramp', polygon:[[40.45406,-79.99671],[40.45405,-79.99688],[40.45347,-79.99650],[40.45357,-79.99632],[40.45396,-79.99666]] },
  { id:'b_z5_3', zoneId:'z5', name:'Tripoli Bridge', polygon:[[40.45650,-79.99857],[40.45636,-79.99853],[40.45654,-79.99750],[40.45668,-79.99754],[40.45651,-79.99854]] },
  { id:'b_z5_4', zoneId:'z5', name:'North St. Bridge', polygon:[[40.45702,-79.99872],[40.45692,-79.99870],[40.45719,-79.99790],[40.45724,-79.99772],[40.45735,-79.99774],[40.45729,-79.99796],[40.45703,-79.99868]] },
  { id:'b_z5_5', zoneId:'z5', name:'East St. Off Ramp', polygon:[[40.45718,-79.99901],[40.45723,-79.99881],[40.45838,-79.99918],[40.45862,-79.99819],[40.45879,-79.99825],[40.45849,-79.99947],[40.45722,-79.99905]] },
  { id:'b_z5_6', zoneId:'z5', name:'East Ohio Ramps', polygon:[[40.45409,-79.99778],[40.45388,-79.99773],[40.45407,-79.99670],[40.45425,-79.99677],[40.45409,-79.99777]] },
  { id:'b_z7_1', zoneId:'z7', name:'Dunloe Ave.', polygon:[[40.45787,-80.00205],[40.45776,-80.00202],[40.45796,-80.00100],[40.45798,-80.00075],[40.45800,-80.00055],[40.45808,-80.00042],[40.45821,-80.00037],[40.45832,-80.00038],[40.45841,-80.00046],[40.45847,-80.00057],[40.45853,-80.00060],[40.45845,-80.00100],[40.45835,-80.00096],[40.45838,-80.00081],[40.45839,-80.00068],[40.45832,-80.00057],[40.45823,-80.00050],[40.45815,-80.00057],[40.45812,-80.00072],[40.45812,-80.00087],[40.45789,-80.00199]] },
  { id:'b_z7_2', zoneId:'z7', name:'Knoll St.', polygon:[[40.45746,-80.00192],[40.45733,-80.00189],[40.45763,-80.00027],[40.45778,-80.00031],[40.45749,-80.00186]] },
  { id:'b_z7_3', zoneId:'z7', name:'Ocala St.', polygon:[[40.45744,-80.00148],[40.45747,-80.00133],[40.45656,-80.00103],[40.45654,-80.00117],[40.45740,-80.00145]] },
  { id:'b_z7_4', zoneId:'z7', name:'Linden Pl.', polygon:[[40.45752,-80.00100],[40.45755,-80.00087],[40.45665,-80.00057],[40.45663,-80.00070],[40.45749,-80.00099]] },
  { id:'b_z7_5', zoneId:'z7', name:'Middle St.', polygon:[[40.45760,-80.00053],[40.45766,-80.00026],[40.45676,-79.99997],[40.45672,-80.00020],[40.45757,-80.00050]] },
  { id:'b_z8_1', zoneId:'z8', name:'Vista St.', polygon:[[40.45828,-79.99807],[40.45813,-79.99804],[40.45859,-79.99560],[40.45874,-79.99564]] },
  { id:'b_z8_2', zoneId:'z8', name:'Concord St.', polygon:[[40.45772,-79.99785],[40.45758,-79.99780],[40.45805,-79.99539],[40.45821,-79.99546],[40.45776,-79.99774]] },
  { id:'b_z8_3', zoneId:'z8', name:'Spring Garden Ave', polygon:[[40.45738,-79.99769],[40.45723,-79.99772],[40.45772,-79.99529],[40.45787,-79.99535]] },
  { id:'b_z8_4', zoneId:'z8', name:'Tripoli St.', polygon:[[40.45668,-79.99753],[40.45656,-79.99750],[40.45701,-79.99505],[40.45719,-79.99511],[40.45671,-79.99745]] },
  { id:'b_z8_5', zoneId:'z8', name:'Suismon St.', polygon:[[40.45589,-79.99728],[40.45572,-79.99722],[40.45622,-79.99480],[40.45638,-79.99485],[40.45591,-79.99721]] },
  { id:'b_z8_6', zoneId:'z8', name:'Peralta St.', polygon:[[40.45545,-79.99712],[40.45533,-79.99709],[40.45579,-79.99466],[40.45592,-79.99470],[40.45547,-79.99704]] },
  { id:'b_z8_7', zoneId:'z8', name:'Phineas St.', polygon:[[40.45492,-79.99694],[40.45481,-79.99691],[40.45537,-79.99452],[40.45552,-79.99456],[40.45494,-79.99687]] },
  { id:'b_z8_8', zoneId:'z8', name:'East Ohio St.', polygon:[[40.45429,-79.99673],[40.45403,-79.99665],[40.45446,-79.99491],[40.45483,-79.99429],[40.45493,-79.99437],[40.45509,-79.99442],[40.45474,-79.99504],[40.45465,-79.99523]] },
  { id:'b_z8_9', zoneId:'z8', name:'Madison Ave.', polygon:[[40.45407,-79.99667],[40.45404,-79.99686],[40.45720,-79.99791],[40.45828,-79.99828],[40.45830,-79.99805],[40.45738,-79.99769],[40.45708,-79.99767],[40.45420,-79.99669]] },
  { id:'b_z8_10', zoneId:'z8', name:'Chestnut St.', polygon:[[40.45825,-79.99548],[40.45822,-79.99565],[40.45474,-79.99452],[40.45485,-79.99429],[40.45494,-79.99436],[40.45820,-79.99546]] },
  { id:'b_z9_1', zoneId:'z9', name:'Vinial St.', polygon:[[40.45821,-79.99545],[40.45801,-79.99541],[40.45814,-79.99479],[40.45668,-79.99134],[40.45678,-79.99117],[40.45838,-79.99481]] },
  { id:'b_z9_2', zoneId:'z9', name:'Wettach St.', polygon:[[40.45726,-79.99281],[40.45727,-79.99260],[40.45629,-79.99229],[40.45626,-79.99228],[40.45623,-79.99245]] },
  { id:'b_z9_3', zoneId:'z9', name:'Constance St.', polygon:[[40.45798,-79.99473],[40.45802,-79.99453],[40.45596,-79.99387],[40.45591,-79.99406]] },
  { id:'b_z9_4', zoneId:'z9', name:'Peralta St.', polygon:[[40.45594,-79.99470],[40.45576,-79.99464],[40.45625,-79.99233],[40.45641,-79.99238]] },
  { id:'b_z9_5', zoneId:'z9', name:'Phineas St.', polygon:[[40.45557,-79.99457],[40.45535,-79.99448],[40.45574,-79.99292],[40.45598,-79.99249],[40.45677,-79.99113],[40.45688,-79.99137],[40.45598,-79.99291],[40.45589,-79.99321],[40.45559,-79.99449]] },
  { id:'b_z9_6', zoneId:'z9', name:'Pedestrian Walkways', polygon:[[40.45649,-79.99156],[40.45603,-79.99130],[40.45500,-79.99242],[40.45532,-79.99289],[40.45459,-79.99404],[40.45435,-79.99393],[40.45398,-79.99349],[40.45448,-79.99286],[40.45451,-79.99271],[40.45599,-79.99107],[40.45660,-79.99141]] },
  { id:'b_z9_7', zoneId:'z9', name:'Expressway', polygon:[[40.45489,-79.99430],[40.45458,-79.99405],[40.45576,-79.99205],[40.45609,-79.99112],[40.45638,-79.99128],[40.45577,-79.99277]] },
];

// ── Zone status and events: filled from real data ───────────

// Every zone starts as "never cleaned" until a real check-in says otherwise.
export const ZONE_META = Object.fromEntries(
  ZONES.map((z) => [z.id, { lastCleanup: null, daysSince: 999, nextEvent: { date: 'TBD', time: '' } }]),
);

export const STATUS_STYLE = {
  clean: { color: '#2ed573', label: 'Recently cleaned' },
  overdue: { color: '#ffa502', label: 'Getting overdue' },
  attention: { color: '#e74c3c', label: 'Needs attention' },
};

export function getZoneStatus(zoneId) {
  const meta = ZONE_META[zoneId];
  if (!meta) return 'attention';
  if (meta.daysSince <= 10) return 'clean';
  if (meta.daysSince <= 30) return 'overdue';
  return 'attention';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// '09:00:00' -> '9:00 AM'
export function formatEventTime(t) {
  if (!t) return 'Time to be announced';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// One row from the server's get_events() in the shape the screens use.
export function normalizeEvent(r) {
  const [y, m, d] = String(r.event_date).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const spots = r.spots == null ? null : Number(r.spots);
  const going = Number(r.going) || 0;
  return {
    id: r.id,
    name: r.name,
    organizer: r.organizer,
    zoneId: r.zone_id || null,
    zoneName: r.zone_id ? zoneById(r.zone_id)?.name || '' : '',
    date,
    month: MONTHS[date.getMonth()].toUpperCase(),
    monthTitle: MONTHS[date.getMonth()],
    day: String(date.getDate()),
    time: formatEventTime(r.start_time),
    duration: r.duration || '',
    meeting: r.meeting_point || '',
    supplies: r.supplies || '',
    description: r.description || '',
    spots,
    going,
    spotsLeft: spots == null ? null : Math.max(spots - going, 0),
    sponsored: !!r.sponsored,
    sponsorUrl: r.sponsor_url || '',
    rewardType: r.reward_type || null,
    prize: r.prize || '',
    volunteers: Number(r.volunteers) || 0,
    isPast: date < startOfToday(),
  };
}

// Rebuilds each zone's status from the server's zone activity and approved events.
export function setZoneMeta(activity = [], events = []) {
  ZONES.forEach((z) => {
    ZONE_META[z.id] = { lastCleanup: null, daysSince: 999, nextEvent: { date: 'TBD', time: '' } };
  });
  const now = Date.now();
  activity.forEach((a) => {
    const meta = ZONE_META[a.zone_id];
    if (!meta || !a.last_cleanup) return;
    meta.lastCleanup = a.last_cleanup;
    meta.daysSince = Math.max(0, Math.floor((now - new Date(a.last_cleanup).getTime()) / 86400000));
  });
  events
    .map(normalizeEvent)
    .filter((e) => !e.isPast && e.zoneId && ZONE_META[e.zoneId])
    .sort((a, b) => a.date - b.date)
    .forEach((e) => {
      const meta = ZONE_META[e.zoneId];
      if (meta.nextEvent.date === 'TBD') meta.nextEvent = { date: `${e.monthTitle} ${e.day}`, time: e.time };
    });
}

export const ZONE_MASCOTS = [
  { zoneId: 'z1', emoji: '🦉', name: 'Olive the Owl', motto: 'Watch over the park.' },
  { zoneId: 'z2', emoji: '🦝', name: 'Rusty the Raccoon', motto: 'Leave it cleaner than you found it.' },
  { zoneId: 'z3', emoji: '🐿️', name: 'Scout the Squirrel', motto: 'Every scrap, every corner.' },
  { zoneId: 'z4', emoji: '🦆', name: 'Dabble the Duck', motto: 'Keep the fountain clear.' },
  { zoneId: 'z5', emoji: '🐝', name: 'Buzz the Bee', motto: 'Small work, big difference.' },
  { zoneId: 'z6', emoji: '🦌', name: 'Willa the Deer', motto: 'Tread lightly, tidy fully.' },
  { zoneId: 'z7', emoji: '🦊', name: 'Dunloe the Fox', motto: 'Sharp eyes find the litter.' },
  { zoneId: 'z8', emoji: '🐢', name: 'Sheldon the Turtle', motto: 'Slow and steady keeps it clean.' },
  { zoneId: 'z9', emoji: '🦅', name: 'Penny the Eagle', motto: 'Soar high, sweep clean.' },
];
export const MASCOT_UNLOCK_CHECKINS = 1;

export const MIXER = {
  host: 'Discover Deutschtown',
  blurb: 'Every cleaner is invited to our quarterly neighborhood mixer — food, drinks, and the neighbors who keep this place looking good.',
};

// Donations are OFF while the app is in testing (no legal entity or payment account yet).
// Flip to true after the nonprofit exists and VENMO_HANDLE is its real account.
export const DONATIONS_ENABLED = false;

// Left empty on purpose. Set the real account's handle before turning donations on.
export const VENMO_HANDLE = '';

export function zoneById(id) {
  return ZONES.find((z) => z.id === id) || null;
}

export function blockById(id) {
  return BLOCKS.find((b) => b.id === id) || null;
}

export function blocksForZone(zoneId) {
  return BLOCKS.filter((b) => b.zoneId === zoneId);
}

export function computeScore(minutes, areaIds, adoptedBlockIds = []) {
  const base = Math.max(SCORING.minimumPoints, Math.round(minutes * SCORING.pointsPerMinute));
  const hot = bestHotSpot(areaIds);
  let multiplier = hot ? hot.multiplier : 1;
  if (areaIds.some((id) => adoptedBlockIds.includes(id))) {
    multiplier = Math.max(multiplier, ADOPTION_RULES.pointsMultiplier);
  }
  return { base, multiplier, total: base * multiplier, hot };
}

export function formatMinutes(mins) {
  mins = Math.round(mins || 0);
  if (mins < 60) return mins + ' min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}
