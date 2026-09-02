function afOpenShift_(actor, openingCash, note) {
  const existing = afFindActiveShift_(actor.userId);
  if (existing) throw new Error('SHIFT_ALREADY_OPEN');
  const id = afGenerateId_('SH');
  const now = afNow_();
  afAppendObject_(AF_SHEET.SHIFT,{
    ID_Shift:id,ID_User:actor.userId,Nama_User:actor.name,Mulai:now,Selesai:'',
    Lat_Mulai:'',Lng_Mulai:'',Status:'Aktif',Modal_Awal:afNumber_(openingCash),Total_Penjualan:0,Catatan:note||''
  });
  return {shiftId:id,status:'Aktif',openedAt:now};
}

function afCloseShift_(actor, closingCash, note) {
  const shift=afFindActiveShift_(actor.userId);
  if(!shift) throw new Error('NO_ACTIVE_SHIFT');
  const sheet=afGetSheet_(AF_SHEET.SHIFT);
  const data=sheet.getDataRange().getValues(), headers=data[0];
  const row=data.findIndex((r,i)=>i>0 && String(r[headers.indexOf('ID_User')]).trim()===actor.userId && String(r[headers.indexOf('Status')]).toUpperCase()==='AKTIF');
  if(row<1) throw new Error('SHIFT_ROW_NOT_FOUND');
  const now=afNow_();
  sheet.getRange(row+1,headers.indexOf('Selesai')+1).setValue(now);
  sheet.getRange(row+1,headers.indexOf('Status')+1).setValue('Selesai');
  if(headers.indexOf('Catatan')>=0) sheet.getRange(row+1,headers.indexOf('Catatan')+1).setValue(note||'');
  return {shiftId:shift.ID_Shift||shift.ShiftId,status:'Selesai',closedAt:now,closingCash:afNumber_(closingCash)};
}