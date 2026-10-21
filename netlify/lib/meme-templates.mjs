const PICKS={
 '181913649':{layout:'drake',meaning:'Drake rejects the top and approves the bottom: the verified fact the AI refuses goes on top; the wrong belief it insists on goes below.'},
 '55311130':{layout:'classic',meaning:'This Is Fine: the situation is falling apart while the AI stays calm. For a confidently wrong answer.'},
 '97984':{layout:'classic',meaning:'Disaster Girl: the background burns while the foreground smiles. For an AI that derails a plan with confidence.'},
 '4087833':{layout:'classic',meaning:'Waiting Skeleton: waiting so long you become a skeleton. For waiting on an AI to recall something already shared.'}
};
export async function getMemeTemplates(){
 const r=await fetch('https://api.imgflip.com/get_memes',{headers:{'User-Agent':'MemoryGlitch/3.0'},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('The meme library is temporarily unavailable.');const data=await r.json();if(data.success!==true||!Array.isArray(data.data?.memes))throw new Error('The meme library returned an invalid response.');
 const memes=(data.data?.memes||[]).filter(m=>PICKS[m.id]&&/^https:\/\/i\.imgflip\.com\/[a-z0-9]+\.(jpg|png)$/i.test(m.url)&&Number.isFinite(m.width)&&m.width>0&&m.width<=10000&&Number.isFinite(m.height)&&m.height>0&&m.height<=10000);
 if(!memes.length)throw new Error('The meme library did not return any selected templates.');
 return memes.map(m=>({id:m.id,name:m.name,url:m.url,width:m.width,height:m.height,sourceUrl:'https://imgflip.com/memegenerator/'+m.id,provider:'Imgflip',...PICKS[m.id]}));
}
