"""Extract and repack unchanged AFS entries from the user's ISO for this scenario.

The original resource numbers are preserved. Only unused entries are omitted.
No game data, palettes, animation tables or sound samples are modified.
"""
import argparse
import json
import pathlib
import struct
import hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('iso', nargs='?', default=str(ROOT / 'Street Fighter III - 3rd Strike (English v1.0).iso'))
args = parser.parse_args()
assets = ROOT / 'web/assets'
assets.mkdir(parents=True, exist_ok=True)
iso = pathlib.Path(args.iso)

def u32(data, at):
    return struct.unpack_from('<I', data, at)[0]

with iso.open('rb') as disc:
    disc.seek(16*2048)
    pvd = disc.read(2048)
    if pvd[1:6] != b'CD001':
        raise ValueError('Expected an ISO9660 filesystem on the PS2 disc image.')
    def find(lba, size):
        disc.seek(lba*2048)
        data = disc.read(size)
        i = 0
        while i < len(data):
            length = data[i]
            if not length:
                i = (i//2048+1)*2048
                continue
            record = data[i:i+length]
            i += length
            name = record[33:33+record[32]]
            if name in (b'\0', b'\1'):
                continue
            name = name.decode('ascii').split(';')[0]
            pos, count = u32(record, 2), u32(record, 10)
            if name == 'SF33RD.AFS':
                return pos*2048, count
            if record[25] & 2:
                found = find(pos, count)
                if found:
                    return found
    root = pvd[156:190]
    location = find(u32(root, 2), u32(root, 10))
    if not location:
        raise ValueError('SF33RD.AFS was not found in the supplied disc image.')
    start, size = location
    disc.seek(start)
    if disc.read(4) != b'AFS\0':
        raise ValueError('Invalid AFS archive.')
    count = struct.unpack('<I', disc.read(4))[0]
    table = [struct.unpack('<II', disc.read(8)) for _ in range(count)]
    names_offset, names_size = struct.unpack('<II', disc.read(8))
    if not names_offset:
        disc.seek(start+table[0][0]-8)
        names_offset, names_size = struct.unpack('<II', disc.read(8))
    entries = []
    for i, (offset, length) in enumerate(table):
        disc.seek(start+names_offset+i*48)
        name = disc.read(32).split(b'\0')[0].decode('ascii')
        if offset+length > size:
            raise ValueError(f'AFS entry {i} is outside the archive.')
        entries.append({'id':i, 'offset':offset, 'size':length, 'name':name})
    # Original HUD palettes are shared with SelectNew.ppg; no selector sprites are loaded.
    needed = {
        'SE.bd','Ake3rd.ppg','default.bin','scrscrn.ppg','SelectNew.ppg',
        'ef06.bin','ef40.bin',
        'pl11.bin','ef07_E.bin','pl11pl.bin','PL11.bd',
        'pl16.bin','ef07_I.bin','pl16pl.bin','PL15.bd',
        'bg110.bin','bg02_B.bin','stage11.ppg',
    }
    packed = []
    with (assets/'challenge.afs').open('wb') as out:
        out.write(b'AFS\0'+struct.pack('<I',count)+bytes(count*8+8))
        compact_table = []
        for entry in entries:
            name = entry['name']
            keep = name in needed or name.startswith('03_C_NYC_')
            if not keep:
                compact_table.append((0,0))
                continue
            out.write(bytes((-out.tell())%2048))
            position = out.tell()
            disc.seek(start+entry['offset'])
            blob = disc.read(entry['size'])
            if len(blob) != entry['size']:
                raise ValueError(f'Truncated resource {name}')
            out.write(blob)
            compact_table.append((position,len(blob)))
            packed.append({**entry, 'sha256':hashlib.sha256(blob).hexdigest()})
        out.seek(8)
        for entry in compact_table:
            out.write(struct.pack('<II',*entry))
    (assets/'manifest.json').write_text(json.dumps({'source_iso':iso.name,'source_afs_bytes':size,'resources':packed},indent=2)+'\n')
    print(f'Prepared {len(packed)} unchanged resources, {(assets/"challenge.afs").stat().st_size/1048576:.1f} MiB.')
