import PDFDocument from 'pdfkit';

const COLORS = {
  primary: '#6D28D9',
  dark: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  surfaceAlt: '#F3F4F6',
  white: '#FFFFFF',
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const SUPPORT_EMAIL = 'support@paramsukhonlinegurukul.com';

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const plainOrder = (order) => (typeof order.toObject === 'function' ? order.toObject() : order);

const allocateTax = (items, totalTax) => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  let allocated = 0;

  return items.map((item, index) => {
    const lineSubtotal = Number(item.subtotal || 0);
    let lineTax = 0;

    if (index === items.length - 1) {
      lineTax = Math.max(0, Number(totalTax || 0) - allocated);
    } else if (subtotal > 0) {
      lineTax = Math.round(((Number(totalTax || 0) * lineSubtotal) / subtotal) * 100) / 100;
    }

    allocated += lineTax;
    return lineTax;
  });
};

const buildBillToLines = (order) => {
  const address = order.deliveryAddress || {};
  const user = order.user && typeof order.user === 'object' ? order.user : {};
  const customerName = user.displayName || user.name;
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const cityLine = [cityState, address.pincode].filter(Boolean).join(' - ');

  return [
    address.fullName || customerName,
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    cityLine,
    address.country,
    address.phone ? `Phone: ${address.phone}` : '',
    user.email ? `Email: ${user.email}` : '',
  ].filter(Boolean);
};

export const generateOrderInvoicePdf = (order) =>
  new Promise((resolve, reject) => {
    const data = plainOrder(order);
    const items = Array.isArray(data.items) ? data.items : [];
    const pricing = data.pricing || {};
    const invoiceNumber =
      data.invoiceNumber || `INV${String(data.orderNumber || data._id || '').replace(/^ORD/, '')}`;
    const createdAt = data.createdAt || new Date();
    const payment = data.payment || {};
    const totalTax = Number(
      pricing.tax ?? items.reduce((sum, item) => sum + Number(item.tax || 0), 0)
    );
    const subtotal = Number(
      pricing.subtotal ?? items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    );
    const discount = Number(pricing.discount || 0);
    const shipping = Number(pricing.shippingCharge || 0);
    const total = Number(pricing.total ?? subtotal - discount + shipping + totalTax);
    const taxAllocations = allocateTax(items, totalTax);
    const billToLines = buildBillToLines(data);

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `Invoice ${invoiceNumber}`,
        Author: 'ParamSukh',
        Subject: `Order ${data.orderNumber || ''}`,
        CreationDate: new Date(),
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, PAGE_WIDTH, 96).fill(COLORS.primary);
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(COLORS.white)
      .text('PARAMSUKH', MARGIN, 28);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.white)
      .text('Total Wellness Scientific Online Gurukul', MARGIN, 60);
    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor(COLORS.white)
      .text('INVOICE', MARGIN, 28, { width: CONTENT_WIDTH, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(`Invoice No. ${invoiceNumber}`, MARGIN, 62, {
        width: CONTENT_WIDTH,
        align: 'right',
      });

    const infoTop = 126;

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text('BILL TO', MARGIN, infoTop);

    let billToY = infoTop + 16;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.dark)
      .text(billToLines[0] || 'Customer', MARGIN, billToY, { width: 260 });
    billToY = doc.y + 4;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
    for (const line of billToLines.slice(1)) {
      doc.text(line, MARGIN, billToY, { width: 260 });
      billToY = doc.y + 2;
    }

    const detailsX = PAGE_WIDTH - MARGIN - 230;
    let detailsY = infoTop;
    const detailRows = [
      ['Invoice Date', formatDate(createdAt)],
      ['Order No.', data.orderNumber || '-'],
      ['Order Date', formatDate(createdAt)],
      ['Payment', `${payment.method || 'N/A'} · ${payment.status || 'N/A'}`],
      ['Order Status', data.status || '-'],
    ];

    for (const [label, value] of detailRows) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(label.toUpperCase(), detailsX, detailsY, { width: 230, align: 'right' });
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.dark)
        .text(String(value), detailsX, detailsY + 11, { width: 230, align: 'right' });
      detailsY += 31;
    }

    const columns = [
      { label: '#', x: MARGIN, width: 20, align: 'left' },
      { label: 'DESCRIPTION', x: MARGIN + 22, width: 190, align: 'left' },
      { label: 'QTY', x: MARGIN + 216, width: 30, align: 'center' },
      { label: 'UNIT PRICE', x: MARGIN + 250, width: 70, align: 'right' },
      { label: 'TAX', x: MARGIN + 324, width: 55, align: 'right' },
      { label: 'AMOUNT', x: MARGIN + 383, width: 112.28, align: 'right' },
    ];

    const drawTableHeader = (y) => {
      doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(COLORS.surfaceAlt);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.dark);
      for (const column of columns) {
        doc.text(column.label, column.x, y + 8, {
          width: column.width,
          align: column.align,
        });
      }
      return y + 24;
    };

    let tableY = Math.max(billToY, detailsY) + 22;
    tableY = drawTableHeader(tableY);

    const tableBottom = PAGE_HEIGHT - 100;

    items.forEach((item, index) => {
      const description = item.productName || item.product?.name || 'Product';
      const variant = item.variant?.option
        ? `${item.variant.name || 'Variant'}: ${item.variant.option}`
        : '';
      const descriptionText = variant ? `${description}\n${variant}` : description;
      const descriptionHeight = doc
        .font('Helvetica')
        .fontSize(9)
        .heightOfString(descriptionText, { width: 190, lineGap: 1 });
      const rowHeight = Math.max(28, descriptionHeight + 12);

      if (tableY + rowHeight > tableBottom) {
        doc.addPage();
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.primary)
          .text(`ParamSukh · Invoice ${invoiceNumber}`, MARGIN, 40);
        tableY = drawTableHeader(70);
      }

      if (index % 2 === 1) {
        doc.rect(MARGIN, tableY, CONTENT_WIDTH, rowHeight).fill(COLORS.surface);
      }

      const lineSubtotal = Number(item.subtotal || 0);
      const lineTax = taxAllocations[index] || 0;
      const lineAmount = lineSubtotal + lineTax;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark);
      doc.text(String(index + 1), columns[0].x, tableY + 8, {
        width: columns[0].width,
        align: columns[0].align,
      });
      doc.text(descriptionText, columns[1].x, tableY + 8, {
        width: columns[1].width,
        align: columns[1].align,
        lineGap: 1,
      });
      doc.text(String(item.quantity || 0), columns[2].x, tableY + 8, {
        width: columns[2].width,
        align: columns[2].align,
      });
      doc.text(money(item.price), columns[3].x, tableY + 8, {
        width: columns[3].width,
        align: columns[3].align,
      });
      doc.text(money(lineTax), columns[4].x, tableY + 8, {
        width: columns[4].width,
        align: columns[4].align,
      });
      doc.font('Helvetica-Bold').text(money(lineAmount), columns[5].x, tableY + 8, {
        width: columns[5].width,
        align: columns[5].align,
      });

      doc
        .moveTo(MARGIN, tableY + rowHeight)
        .lineTo(PAGE_WIDTH - MARGIN, tableY + rowHeight)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      tableY += rowHeight;
    });

    if (tableY > PAGE_HEIGHT - 240) {
      doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text(`ParamSukh · Invoice ${invoiceNumber}`, MARGIN, 40);
      tableY = 70;
    }

    let totalsY = tableY + 18;
    const totalsLabelX = PAGE_WIDTH - MARGIN - 250;
    const totalsValueX = PAGE_WIDTH - MARGIN - 110;

    const drawTotalRow = (label, value, { bold = false, color = COLORS.dark } = {}) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 11 : 9)
        .fillColor(color)
        .text(label, totalsLabelX, totalsY, { width: 130, align: 'left' });
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 11 : 9)
        .fillColor(color)
        .text(value, totalsValueX, totalsY, { width: 110, align: 'right' });
      totalsY += bold ? 20 : 16;
    };

    drawTotalRow('Subtotal', money(subtotal));

    if (discount > 0) {
      const discountLabel = data.coupon?.code
        ? `Discount (${data.coupon.code})`
        : data.offer?.title
          ? `Discount (${data.offer.title})`
          : 'Discount';
      drawTotalRow(discountLabel, `- ${money(discount)}`, { color: '#059669' });
    }

    if (shipping > 0) {
      drawTotalRow('Shipping', money(shipping));
    }

    if (totalTax > 0) {
      drawTotalRow('Tax (GST)', money(totalTax));
    }

    doc
      .moveTo(totalsLabelX, totalsY)
      .lineTo(PAGE_WIDTH - MARGIN, totalsY)
      .strokeColor(COLORS.border)
      .lineWidth(0.8)
      .stroke();
    totalsY += 10;

    const isPaid = String(payment.status || '').toLowerCase() === 'completed';
    drawTotalRow(isPaid ? 'Amount Paid' : 'Amount Due', money(total), {
      bold: true,
      color: COLORS.primary,
    });

    if (payment.transactionId || payment.razorpayPaymentId) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Payment reference: ${payment.transactionId || payment.razorpayPaymentId}`,
          MARGIN,
          totalsY + 4,
          { width: CONTENT_WIDTH - 250, align: 'left' }
        );
    }

    if (data.customerNotes) {
      const notesText = String(data.customerNotes);
      const notesWidth = CONTENT_WIDTH - 250;
      const notesHeight = doc.font('Helvetica').fontSize(9).heightOfString(notesText, {
        width: notesWidth,
      });
      let notesTop = totalsY + 28;

      if (notesTop + notesHeight > PAGE_HEIGHT - 60) {
        doc.addPage();
        notesTop = 60;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text('CUSTOMER NOTES', MARGIN, notesTop);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.dark)
        .text(notesText, MARGIN, notesTop + 12, {
          width: notesWidth,
        });
    }

    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      const defaultBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          'This is a computer-generated invoice and does not require a signature.',
          MARGIN,
          PAGE_HEIGHT - 42,
          { width: CONTENT_WIDTH, align: 'center' }
        );
      doc.text(
        `Need help? ${SUPPORT_EMAIL} · Page ${index + 1} of ${range.count}`,
        MARGIN,
        PAGE_HEIGHT - 28,
        { width: CONTENT_WIDTH, align: 'center' }
      );
      doc.page.margins.bottom = defaultBottomMargin;
    }

    doc.end();
  });
