import React from 'react';

const percentage = (part, total) => total ? 100 * part / total : 0;

export default function DistributionCharts({ tally }) {
  const share = percentage(tally.marked.length, tally.total);
  return <section className="distribution-charts">
    <figure><figcaption>कुल पर्ची वितरण</figcaption>
      <div className="share-ring" style={{ '--share': share + '%' }}><strong>{share.toFixed(1)}%</strong></div>
      <p><i className="dist-key" /> दी गई {tally.marked.length} <i className="dist-key remaining" /> बाकी {tally.unmarked.length}</p>
    </figure>
    <figure><figcaption>वार्डवार वितरण प्रतिशत</figcaption>
      {tally.wards.map(w => <div className="ward-bar" key={w.ward}><span>वार्ड {w.ward}</span><progress max="100" value={percentage(w.voted,w.total)} /><b>{Math.round(percentage(w.voted,w.total))}%</b></div>)}
    </figure>
    <figure className="range-chart"><figcaption>मोहल्लों का वितरण · कैंडल चार्ट</figcaption>
      <p>हर वार्ड में रेखा न्यूनतम से अधिकतम वितरण दिखाती है। मोटी पट्टी बीच के 50% मोहल्लों की सीमा है।</p>
      {tally.wards.map(w => {
        const rates = [...w.areas.values()].map(a => percentage(a.voted,a.total)).sort((a,b) => a-b);
        function quantile(q) {
          const position = (rates.length-1)*q;
          const low = Math.floor(position);
          return rates[low] + (rates[Math.ceil(position)]-rates[low])*(position-low);
        }
        const [min,q1,q3,max] = [0,.25,.75,1].map(quantile);
        return <div className="ward-bar" key={w.ward}><span>वार्ड {w.ward}</span>
          <div className="candle-track" title={'न्यूनतम '+min.toFixed(1)+'%, मध्य सीमा '+q1.toFixed(1)+'–'+q3.toFixed(1)+'%, अधिकतम '+max.toFixed(1)+'%'}>
            <i style={{left:min+'%',width:(max-min)+'%'}}/><b style={{left:q1+'%',width:(q3-q1)+'%'}}/>
          </div><small>{Math.round(min)}–{Math.round(max)}%</small></div>;
      })}
    </figure>
  </section>;
}
