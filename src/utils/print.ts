export const printReport = (title: string, rows: Record<string, any>[]) => {
  if (!rows || rows.length === 0) {
    alert('No data to print');
    return;
  }
  
  const columns = Object.keys(rows[0]);
  
  const tableHeaders = columns.map(col => `<th style="padding: 8px 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; text-align: left; font-weight: 600; color: #374151; font-size: 13px;">${col}</th>`).join('');
  
  const tableRows = rows.map(row => {
    return `<tr>${columns.map(col => `<td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #111827; font-size: 13px;">${row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}</td>`).join('')}</tr>`;
  }).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups for printing');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            body { 
              padding: 0; 
              margin: 15px; 
            }
            @page {
              margin: 10mm;
              size: landscape;
            }
          }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 30px; 
            color: #111827;
            background: white;
          }
          h1 { 
            text-align: center; 
            margin-bottom: 20px; 
            color: #111827;
            font-size: 24px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            background: white;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          // Automatic print trigger
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            }, 250);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
