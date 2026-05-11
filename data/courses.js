// Course data for Golf Games. Loaded as a classic script before app.js;
// the top-level `const COURSES` is visible to other classic scripts in the same realm.
const COURSES = [
  { id:"wasaby", name:"W\u00e4sby GK", par:72,
    holes:[{par:4,si:11},{par:3,si:17},{par:4,si:3},{par:4,si:13},{par:3,si:9},{par:5,si:1},{par:4,si:7},{par:4,si:15},{par:4,si:5},{par:4,si:14},{par:5,si:4},{par:3,si:8},{par:4,si:12},{par:4,si:2},{par:4,si:16},{par:3,si:18},{par:4,si:6},{par:4,si:10}],
    tees:[{name:"Vit",cr:74.0,slope:141},{name:"Gul",cr:71.9,slope:137},{name:"Bl\u00e5",cr:69.5,slope:131},{name:"R\u00f6d",cr:67.6,slope:128}]},
  { id:"brohof_stadium", name:"Bro Hof Stadium", par:72,
    holes:[{par:5,si:8},{par:4,si:4},{par:4,si:18},{par:3,si:16},{par:4,si:2},{par:4,si:14},{par:3,si:12},{par:4,si:10},{par:5,si:6},{par:4,si:3},{par:3,si:15},{par:5,si:7},{par:5,si:9},{par:4,si:17},{par:5,si:1},{par:3,si:11},{par:3,si:5},{par:4,si:13}],
    tees:[{name:"Vit",cr:77.3,slope:148},{name:"Gul",cr:73.1,slope:132},{name:"Bl\u00e5",cr:72.0,slope:132},{name:"R\u00f6d",cr:67.9,slope:122}]},
  { id:"brohof_castle", name:"Bro Hof Castle", par:72,
    holes:[{par:5,si:5},{par:3,si:13},{par:4,si:11},{par:3,si:9},{par:5,si:7},{par:4,si:1},{par:3,si:17},{par:4,si:15},{par:5,si:3},{par:5,si:4},{par:3,si:16},{par:3,si:18},{par:5,si:6},{par:4,si:14},{par:5,si:2},{par:4,si:12},{par:3,si:10},{par:4,si:8}],
    tees:[{name:"Vit",cr:74.2,slope:145},{name:"Gul",cr:71.2,slope:139},{name:"Bl\u00e5",cr:68.9,slope:133},{name:"R\u00f6d",cr:65.3,slope:127}]},
  { id:"osteraker", name:"\u00d6ster by Stenson", par:72,
    holes:[{par:4,si:11},{par:4,si:15},{par:4,si:1},{par:3,si:17},{par:5,si:7},{par:4,si:3},{par:3,si:13},{par:5,si:9},{par:4,si:5},{par:4,si:10},{par:3,si:18},{par:4,si:2},{par:5,si:12},{par:4,si:14},{par:3,si:4},{par:4,si:16},{par:4,si:8},{par:5,si:6}],
    tees:[{name:"Vit",cr:73.2,slope:131},{name:"Gul",cr:70.6,slope:129},{name:"Bl\u00e5",cr:67.9,slope:124},{name:"R\u00f6d",cr:64.9,slope:117}]},
  { id:"omberg", name:"Omberg GK", par:71,
    holes:[{par:4,si:11},{par:4,si:17},{par:4,si:1},{par:4,si:13},{par:3,si:9},{par:4,si:7},{par:4,si:5},{par:5,si:3},{par:3,si:15},{par:4,si:10},{par:3,si:16},{par:4,si:12},{par:3,si:18},{par:5,si:4},{par:3,si:14},{par:5,si:8},{par:4,si:2},{par:5,si:6}],
    tees:[{name:"Vit",cr:72.4,slope:135},{name:"Gul",cr:70.8,slope:132},{name:"Bl\u00e5",cr:67.8,slope:126},{name:"R\u00f6d",cr:66.3,slope:123}]},
  { id:"marco_simone", name:"Marco Simone G&CC", par:72,
    holes:[{par:4,si:11},{par:4,si:1},{par:4,si:3},{par:3,si:17},{par:4,si:13},{par:4,si:15},{par:3,si:5},{par:5,si:9},{par:5,si:7},{par:4,si:4},{par:4,si:16},{par:5,si:12},{par:3,si:18},{par:4,si:6},{par:4,si:2},{par:4,si:10},{par:3,si:14},{par:5,si:8}],
    tees:[{name:"Vit",cr:74.1,slope:133},{name:"Gul",cr:72.1,slope:129},{name:"Bl\u00e5",cr:78.0,slope:144},{name:"R\u00f6d",cr:75.0,slope:137}]},
  { id:"parco_medici", name:"Parco De' Medici", par:72,
    holes:[{par:4,si:9},{par:5,si:17},{par:3,si:15},{par:4,si:1},{par:5,si:13},{par:3,si:5},{par:4,si:7},{par:4,si:3},{par:5,si:11},{par:4,si:4},{par:3,si:8},{par:5,si:6},{par:3,si:16},{par:4,si:14},{par:4,si:12},{par:3,si:10},{par:5,si:18},{par:4,si:2}],
    tees:[{name:"Vit",cr:73.0,slope:136},{name:"Gul",cr:71.1,slope:136},{name:"Bl\u00e5",cr:74.7,slope:137},{name:"R\u00f6d",cr:72.7,slope:130}]},
  { id:"kyssinge", name:"Kyssinge Golf", par:74,
    holes:[{par:4,si:11},{par:5,si:17},{par:5,si:5},{par:4,si:9},{par:3,si:13},{par:4,si:15},{par:4,si:1},{par:3,si:7},{par:5,si:3},{par:4,si:4},{par:5,si:2},{par:4,si:12},{par:4,si:14},{par:5,si:6},{par:3,si:8},{par:4,si:16},{par:3,si:18},{par:5,si:10}],
    tees:[{name:"Vit",cr:73.9,slope:135},{name:"Gul",cr:71.0,slope:129},{name:"Bl\u00e5",cr:69.2,slope:125},{name:"R\u00f6d",cr:66.8,slope:121}]}
];
