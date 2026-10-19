// Auto-ported from index.html (makeSlug / bnTranslit) so server slugs == browser slugs.
// Do NOT edit by hand unless you change the same code in index.html.
const BN_VOWEL = {'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou'};
const BN_KAR   = {'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou'};
const BN_CONS  = {'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n','ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n','প':'p','ফ':'f','ব':'b','ভ':'bh','ম':'m','য':'j','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h','\u09DC':'r','\u09DD':'rh','\u09DF':'y','ৎ':'t'};
const BN_DIGIT = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
const BN_RE = /[\u0980-\u09FF]/;
const BN_RUN_RE = /[\u0980-\u09FF\u200c\u200d]+/g;

// ZWJ/ZWNJ বাদ + নুক্তা-যুক্ত বর্ণ এক রূপে আনা (ড়, ঢ়, য়)
function _bnNorm(s) {
  return String(s || '').replace(/[\u200c\u200d]/g, '')
    .replace(/\u09A1\u09BC/g, '\u09DC').replace(/\u09A2\u09BC/g, '\u09DD').replace(/\u09AF\u09BC/g, '\u09DF');
}

/* ── শব্দ-অভিধান: যেসব শব্দ উচ্চারণ-নিয়মে ঠিক আসে না (ইংরেজি loan-word, নাম, ধর্মীয় শব্দ) ── */
const BN_WORDS_RAW = {
  // ইংরেজি ছোট শব্দ
  'শী':'she','হি':'he','হার':'her','হিজ':'his','দ্য':'the','দ্যা':'the','দি':'the','অ্যান্ড':'and','এন্ড':'and','অ্যান্ড':'and',
  'অফ':'of','অব':'of','ইন':'in','অন':'on','টু':'to','ফর':'for','উইথ':'with','ফ্রম':'from','অ্যাট':'at','বাই':'by','ইজ':'is',
  'ইট':'it','ইউ':'you','মাই':'my','ইয়োর':'your','আওয়ার':'our','দেম':'them','দেয়ার':'there','নট':'not','নো':'no','ওয়ান':'one','থ্রি':'three',
  'হু':'who','হোয়াট':'what','হোয়েন':'when','হোয়্যার':'where','হোয়াই':'why','হাউ':'how','অল':'all','ইফ':'if','অ্যাজ':'as','অর':'or','বাট':'but',
  // সাধারণ ইংরেজি শব্দ
  'ক্যাট':'cat','ডগ':'dog','বুক':'book','বুকস':'books','লাভ':'love','লাইফ':'life','ডেথ':'death','ওয়ার':'war','পিস':'peace','টাইম':'time',
  'ডে':'day','নাইট':'night','সান':'sun','মুন':'moon','স্টার':'star','স্টোরি':'story','স্টোরিজ':'stories','ডায়েরি':'diary','লেটার':'letter',
  'গার্ল':'girl','বয়':'boy','ম্যান':'man','ওম্যান':'woman','কিং':'king','কুইন':'queen','প্রিন্স':'prince','প্রিন্সেস':'princess',
  'হাউস':'house','হোম':'home','ওয়ার্ল্ড':'world','ম্যাজিক':'magic','ড্রিম':'dream','সিক্রেট':'secret','মানি':'money','রিচ':'rich','পুওর':'poor',
  'ড্যাড':'dad','মম':'mom','ফাদার':'father','মাদার':'mother','ব্রাদার':'brother','সিস্টার':'sister','ফ্রেন্ড':'friend','গড':'god',
  'গোল্ড':'gold','সিলভার':'silver','বার্ড':'bird','ট্রি':'tree','ফ্লাওয়ার':'flower','রিভার':'river','সী':'sea','ওশান':'ocean',
  'মাউন্টেন':'mountain','গার্ডেন':'garden','স্কুল':'school','কলেজ':'college','ইউনিভার্সিটি':'university','টিচার':'teacher',
  'স্টুডেন্ট':'student','ডক্টর':'doctor','প্রফেসর':'professor','ফাস্ট':'fast','স্লো':'slow','পাওয়ার':'power','মাইন্ড':'mind','মাইন্ডসেট':'mindset',
  'সাকসেস':'success','ফেইল':'fail','ডিজিটাল':'digital','টিপস':'tips','গাইড':'guide','হ্যান্ডবুক':'handbook','ওয়ার্কবুক':'workbook',
  'নোট':'note','নোটস':'notes','স্টাডি':'study','প্র্যাকটিস':'practice','টেস্ট':'test','মডেল':'model','সলিউশন':'solution','ভলিউম':'volume',
  'পার্ট':'part','সিরিজ':'series','এডিশন':'edition','কালেকশন':'collection','সেট':'set','কম্বো':'combo','বক্স':'box','প্যাক':'pack',
  'অফার':'offer','স্পেশাল':'special','প্রিমিয়াম':'premium','অরিজিনাল':'original','ক্লাসিক':'classic','বেস্ট':'best','বেস্টসেলার':'bestseller',
  'নিউ':'new','ফ্রি':'free','ডিসকাউন্ট':'discount','হ্যাবিট':'habit','হ্যাবিটস':'habits','অ্যাটমিক':'atomic','থিংকিং':'thinking','থিঙ্কিং':'thinking',
  'ডিপ':'deep','ওয়ার্ক':'work','গ্রো':'grow','গুড':'good','ব্যাড':'bad','ডার্ক':'dark','লাইট':'light','ফায়ার':'fire','ওয়াটার':'water',
  // বিষয়
  'সায়েন্স':'science','ফিকশন':'fiction','মোটিভেশন':'motivation','ক্যারিয়ার':'career','সাইকোলজি':'psychology','ফিলোসফি':'philosophy',
  'হিস্ট্রি':'history','বায়োগ্রাফি':'biography','অটোবায়োগ্রাফি':'autobiography','ম্যানেজমেন্ট':'management','ম্যাথ':'math',
  'ম্যাথম্যাটিক্স':'mathematics','ফিজিক্স':'physics','কেমিস্ট্রি':'chemistry','বায়োলজি':'biology','ইংলিশ':'english','গ্রামার':'grammar',
  'ডিকশনারি':'dictionary','ভোকাবুলারি':'vocabulary','স্পোকেন':'spoken','রাইটিং':'writing','রিডিং':'reading','লিসেনিং':'listening',
  'আইইএলটিএস':'ielts','সফটওয়্যার':'software','কম্পিউটার':'computer','প্রোগ্রামিং':'programming','ইন্টারনেট':'internet',
  'মার্কেটিং':'marketing','বিজনেস':'business','ইনভেস্টমেন্ট':'investment','স্টক':'stock','লিডারশিপ':'leadership','ফ্রিল্যান্সিং':'freelancing',
  'ইসলামিক':'islamic','অনলাইন':'online','মোবাইল':'mobile','ফেসবুক':'facebook','ইউটিউব':'youtube','গুগল':'google',
  // নাম (বিদেশি)
  'হ্যারি':'harry','পটার':'potter','শার্লক':'sherlock','হোমস':'holmes','ডেভিড':'david','জন':'john','জেমস':'james','মার্ক':'mark',
  'স্টিফেন':'stephen','আইনস্টাইন':'einstein','নিউটন':'newton','ডারউইন':'darwin','এডগার':'edgar','অ্যালান':'allan','পো':'poe','ডেল':'dale',
  'কার্নেগি':'carnegie','নেপোলিয়ন':'napoleon','হিল':'hill','রবার্ট':'robert','কিয়োসাকি':'kiyosaki','ক্লিয়ার':'clear','টনি':'tony',
  'রবিন':'robin','শর্মা':'sharma','অ্যান্ডি':'andy','ডেল কার্নেগি':'dale-carnegie',
  // বাংলা ও ইসলামী শব্দ
  'ইসলামী':'islami','ইসলাম':'islam','কুরআন':'quran','কোরআন':'quran','কুরান':'quran','হাদিস':'hadith','হাদীস':'hadith','সীরাত':'sirat','নবী':'nabi',
  'রাসূল':'rasul','রাসুল':'rasul','আল্লাহ':'allah','ইমাম':'imam','সাহাবী':'sahabi','দোয়া':'dua','দুআ':'dua','নামাজ':'namaz','নামায':'namaz',
  'রোজা':'roja','হজ্জ':'hajj','হজ':'hajj','যাকাত':'zakat','জান্নাত':'jannat','জাহান্নাম':'jahannam','ফিকহ':'fiqh','তাফসীর':'tafsir',
  'সহীহ':'sahih','বুখারী':'bukhari','মুসলিম':'muslim','ঈমান':'iman','আরবি':'arabi','আরবী':'arabi','মুহাম্মদ':'muhammad','মুহাম্মাদ':'muhammad',
  'মোহাম্মদ':'mohammad','মোঃ':'md','মো':'md','আব্দুল':'abdul','আবদুল':'abdul','আব্দুর':'abdur','আবদুর':'abdur','হুমায়ূন':'humayun',
  'আহমেদ':'ahmed','আহমদ':'ahmad','বই':'boi','বাংলা':'bangla','বাংলাদেশ':'bangladesh','ঢাকা':'dhaka','ভারত':'bharat','কলকাতা':'kolkata',
  'উপন্যাস':'uponnash','অনুবাদ':'anubad','রচনাসমগ্র':'rochonasomogro','সমগ্র':'somogro','ইতিহাস':'itihas','সায়েন্স-ফিকশন':'science-fiction'
};
const BN_WORDS = {};
Object.keys(BN_WORDS_RAW).forEach(k => { BN_WORDS[_bnNorm(k)] = BN_WORDS_RAW[k]; });
let BN_WORDS_EXTRA = {};   // অ্যাডমিন নিজে যে শব্দ যোগ করে (admin.html-এ লোড হয়)

// সংযুক্ত বর্ণে পূর্বের ধ্বনি দ্বিত্ব (ম্ম, ত্ম, ন্য ...): kh → kkh, t → tt
const _LAST_TOKEN = /(sh|chh|ch|kh|gh|jh|th|dh|bh|ng|rh|[a-z])$/;
function _bnDouble(r) {
  const m = r.match(_LAST_TOKEN); if (!m) return r;
  const t = m[0];
  return (t.length > 1 && t.endsWith('h') && t !== 'sh') ? r.slice(0, -t.length) + t[0] + t : r + t;
}
const _FINAL_NO_O = ['নড','নট','নস','সট','কস'];
// মাঝের 'o' বাদ যাবে এমন জোড়া (সরকার → sorkar, ইসলামী → islami, আহমেদ → ahmed, আবদুল → abdul)
const _SCHWA_DROP = ['রক','রজ','রহ','রম','রত','রদ','রব','রস','সল','সম','সর','সজ','হম','হর','বদ','বর','লম','লত'];

function _bnTranslitRun(run) {
  const ch = [...run];
  const isCons = c => c !== undefined && BN_CONS[c] !== undefined;
  const parseCluster = (i) => {
    const list = [ch[i]]; let j = i + 1;
    while (ch[j] === '্' && isCons(ch[j + 1])) { list.push(ch[j + 1]); j += 2; }
    return { list, next: j };
  };
  let out = '', wordStart = true, syl = 0, i = 0;

  while (i < ch.length) {
    const c = ch[i];

    if (isCons(c)) {
      const { list, next } = parseCluster(i);
      let j = next, halant = false;
      if (ch[j] === '্') { halant = true; j++; }
      const kar = BN_KAR[ch[j]];
      if (kar !== undefined) j++;

      let r = '', special = false;
      list.forEach((cc, k) => {
        const t = BN_CONS[cc];
        if (k === 0) { r = t; return; }
        const prev = list[k - 1];
        if (cc === 'ষ' && prev === 'ক') { r = r.slice(0, -1) + 'kkh'; special = true; }
        else if (cc === 'ঞ' && prev === 'জ') { r = r.slice(0, -1) + 'gg'; special = true; }
        else if (cc === 'গ' && prev === 'ঙ') { /* ঙ্গ → ng */ }
        else if (cc === 'ক' && prev === 'ঙ') { r = r.slice(0, -2) + 'nk'; }
        else if (cc === 'য' || cc === 'ম') {
          if (k === 1 && wordStart) r += (cc === 'য' ? 'y' : 'm');
          else if (!special) r = _bnDouble(r);
        }
        else if (cc === 'ব') { if (!(k === 1 && wordStart) && !special) r = _bnDouble(r); }
        else r += t;
      });

      const key = list.join('');
      const nxt = ch[j];
      const wordFinal = !(nxt !== undefined && BN_RE.test(nxt));
      if (kar !== undefined) out += r + kar;
      else if (halant) out += r;
      else if (wordFinal) {
        const afterI = (key === '\u09DF' && (ch[i - 1] === 'ি' || ch[i - 1] === 'ী'));   // প্রিয় → priyo
        out += ((list.length > 1 && !_FINAL_NO_O.includes(key.replace(/্/g, ''))) || afterI) ? r + 'o' : r;
      }
      else {
        let dropO = false;
        if (list.length === 1 && syl >= 1 && isCons(ch[j])) {
          const nc = parseCluster(j);
          if (BN_KAR[ch[nc.next]] !== undefined && _SCHWA_DROP.includes(list[0] + ch[j])) dropO = true;
        }
        out += dropO ? r : r + 'o';
      }
      wordStart = false; syl++; i = j; continue;
    }

    if (c === 'অ' && ch[i + 1] === '্' && ch[i + 2] === 'য' && ch[i + 3] === 'া') { out += 'a'; wordStart = false; syl++; i += 4; continue; }
    if (BN_VOWEL[c] !== undefined) { out += BN_VOWEL[c]; wordStart = false; syl++; i++; continue; }
    if (BN_DIGIT[c] !== undefined) { out += BN_DIGIT[c]; wordStart = false; i++; continue; }
    if (c === 'ং') { out += 'ng'; i++; continue; }
    if (c === 'ঃ' || c === 'ঁ' || c === '়' || c === '্' || BN_KAR[c] !== undefined) { i++; continue; }
    out += ' '; wordStart = true; syl = 0; i++;      // দাঁড়ি ও অন্যান্য বাংলা চিহ্ন
  }
  return out;
}

// পুরো টেক্সট → ইংরেজি অক্ষরে (বাংলা অংশ অভিধান/নিয়মে, বাকি অংশ যেমন আছে)
function bnTranslit(input) {
  const s = _bnNorm(input);
  return s.replace(BN_RUN_RE, run => {
    const w = BN_WORDS_EXTRA[run] !== undefined ? BN_WORDS_EXTRA[run] : BN_WORDS[run];
    return ' ' + (w !== undefined ? w : _bnTranslitRun(run)) + ' ';
  }).replace(/[^\u0000-\u007F]/g, c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

function makeSlug(text, maxLen = 80) {
  let s = bnTranslit(text).toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-[^-]*$/, '') || s.slice(0, maxLen);
  return s.replace(/^-+|-+$/g, '');
}
module.exports = { makeSlug };
