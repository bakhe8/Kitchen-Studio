// Swatches are authored design samples, not measurements of a brand's
// products. patternCm is the intended world-space repeat; light parameters
// are normalized shader inputs. Room and item sizes never depend on tint.
const f=(family,label,color,ink,roughness,metalness,patternCm)=>Object.freeze({family,texture:family,label,color,ink,roughness,metalness,patternCm});
const wood=(l,c,i,r=.49,p=29)=>f('wood',l,c,i,r,.02,p);
const paint=(l,c,i,r=.59)=>f('paint',l,c,i,r,.01,4);
const stone=(l,c,i,r=.53,p=38)=>f('stone',l,c,i,r,.02,p);
const marble=(l,c,i,r=.27,p=70)=>f('marble',l,c,i,r,.02,p);
const quartz=(l,c,i,r=.34,p=13)=>f('quartz',l,c,i,r,.04,p);
const metal=(l,c,i,r=.35,p=9)=>f('metal',l,c,i,r,.82,p);
const porcelain=(l,c,i,r=.29,p=52)=>f('porcelain',l,c,i,r,.01,p);
const common=Object.freeze({
  oak:wood('بلوط فاتح','#c99b62','#574023'),walnut:wood('جوز دافئ','#80543f','#39261e',.4,36),
  ash:wood('دردار رملي','#d3b990','#9a7952',.48,25),teak:wood('ساج عسلي','#a66c40','#69452c',.46,32),
  'smoked-oak':wood('بلوط مدخّن','#675647','#3d342d',.51,27),cherry:wood('كرز نحاسي','#a96148','#69392d',.43,24),
  'olive-wood':wood('خشب زيتون','#a78854','#594528',.42,24),
  ivory:paint('عاجي','#eee7d6','#746b52'),sage:paint('أخضر مريمي','#819885','#3c5144'),
  graphite:paint('غرافيتي','#49525b','#262f37'),navy:paint('أزرق حبري','#344861','#7291a6',.38),
  terracotta:paint('طين محروق','#b4755f','#734734'),olive:paint('زيتوني مطفأ','#8b8b58','#545b3f'),
  'dusty-blue':paint('أزرق ضبابي','#91a4b2','#596e80'),clay:paint('وردي ترابي','#bd9790','#7f5f5e'),
  enamel:paint('مينا كريمية لامعة','#eee8d5','#a49d86',.24),
  limestone:stone('حجر رملي فاتح','#d9cbb0','#897e65'),charcoal:stone('حجر فحمي','#454951','#25292d',.62),
  basalt:stone('بازلت رمادي','#686c68','#424642',.67,23),travertine:stone('ترافرتين كريمي','#cdb797','#978367',.51,42),
  carrara:marble('رخام أبيض بعروق رمادية','#e9e9e3','#989b9c'),verde:marble('رخام أخضر بعروق فاتحة','#465f56','#b6c6af',.24,66),
  emperador:marble('رخام بني بعروق عسلية','#654c41','#ba9c76',.3,51),
  'quartz-snow':quartz('كوارتز ثلجي','#e8e8de','#a8a89f'),'quartz-sand':quartz('كوارتز رملي منقّط','#cbbda6','#95846d',.38,11),
  'quartz-midnight':quartz('كوارتز ليلي','#424950','#9ca5ac',.27,9),
  'brushed-steel':metal('فولاذ مصقول بخطوط دقيقة','#a7adaf','#6f767a',.35,7),
  bronze:metal('برونز ساتاني','#9d7959','#604c3a',.38,8),brass:metal('نحاس أصفر مطفي','#b39660','#736044',.42,8),
  porcelain:porcelain('بورسلان أبيض','#f4f1e9','#b5afa3'),'smoke-porcelain':porcelain('بورسلان دخاني','#a5a29d','#6d7170',.33,54)
});
const select=ids=>Object.freeze(Object.fromEntries(ids.map(id=>[id,common[id]])));
export const kitchenFrontFinishes=select(['oak','walnut','ivory','sage','graphite','ash','smoked-oak','teak','cherry','olive-wood','navy','terracotta','olive','dusty-blue','clay','travertine','basalt','carrara','verde','quartz-sand','brushed-steel','bronze','brass','smoke-porcelain']);
export const kitchenWorktopFinishes=select(['limestone','charcoal','oak','porcelain','walnut','teak','ash','olive-wood','smoked-oak','travertine','basalt','carrara','verde','emperador','quartz-snow','quartz-sand','quartz-midnight','brushed-steel','bronze','brass','smoke-porcelain','enamel']);
export const kitchenMaterialFamilies=Object.freeze({wood:'خشب',stone:'حجر',marble:'رخام',quartz:'كوارتز',paint:'طلاء',metal:'معدن',porcelain:'بورسلان'});
