<script setup lang="ts">
// Properties of the selection. Same-kind multi-select edits the shared fields in one undoable batch.
import { computed } from 'vue'
import { store, notify } from '@/editor/store'
import { execute, batch, updateEntity, locate, type EntityTable, type Entity } from '@/editor/commands'
import { area, dist, edges } from '@/editor/geometry'
import { hostLine, fitAlong, stairRise } from '@/editor/model'
import { solve } from '@/editor/stairs'
import { warningText } from '@/editor/tools/shapes'
import { format, formatArea } from '@/editor/units'
import { FLOOR_MATERIALS, ROOM_KINDS, DOOR_PRESETS, WINDOW_PRESETS, ZONE_KINDS, POOL_DEPTH } from '@/editor/presets'
import { deleteSelection } from '@/editor/clipboard'
import type { Item, Opening, Room, Stair, StairParams, Wall } from '@/types'
import { catalogItem } from '@/catalog'
import LengthInput from './LengthInput.vue'

const sel = computed(() => store.selection.map(id => locate(id)).filter(x => x !== null))
const table = computed<EntityTable | null>(() => {
  const ts = new Set(sel.value.map(s => s.t))
  return ts.size === 1 ? [...ts][0] : null
})
const list = <T extends EntityTable>() => sel.value.map(s => s.e) as Entity<T>[]
const rooms = computed(() => (table.value === 'rooms' ? list<'rooms'>() : []))
const openings = computed(() => (table.value === 'openings' ? list<'openings'>() : []))
const walls = computed(() => (table.value === 'walls' ? list<'walls'>() : []))
const stairs = computed(() => (table.value === 'stairs' ? list<'stairs'>() : []))
const zones = computed(() => (table.value === 'zones' ? list<'zones'>() : []))
const items = computed(() => (table.value === 'items' ? list<'items'>() : []))
const item = computed<Item | null>(() => one(items.value))
const itemDef = computed(() => catalogItem(common(items.value, 'catalogId') ?? ''))
const scaleLimits = computed(() => itemDef.value?.scale ?? { min: 0.5, max: 2 })
function setItems(patch: (it: Item) => Partial<Item>, label = 'Edit items') {
  const cmds = items.value.map(it => updateEntity('items', it.id, patch(it)))
  execute(cmds.length === 1 ? cmds[0] : batch(label, cmds))
}
const zoneItems = Object.entries(ZONE_KINDS).map(([value, z]) => ({ value, label: z.label, icon: z.icon }))
function setZoneKind(kind: string) {
  const cmds = zones.value.map(z => updateEntity('zones', z.id, { kind: kind as never, props: kind === 'pool' ? { depth: POOL_DEPTH, ...z.props } : z.props }))
  execute(cmds.length === 1 ? cmds[0] : batch('Edit zones', cmds))
}

// ---------- stairs ----------
const stairSol = (s: Stair) => solve(s.kind, s.params, stairRise(store.data!, s.floorId, store.settings.slab))
function setStair(patch: Partial<Pick<Stair, 'kind' | 'rotation'>>, params: Partial<StairParams> = {}) {
  const cmds = stairs.value.map(s => updateEntity('stairs', s.id, { ...patch, params: { ...s.params, ...params } }))
  execute(cmds.length === 1 ? cmds[0] : batch('Edit stairs', cmds))
  const w = stairs.value.map(stairSol).flatMap(s => s.warnings)
  if (w.length) notify(warningText(w[0]))
}
const stairKinds = [
  { value: 'straight', label: 'Straight' },
  { value: 'L', label: 'L-shaped' },
  { value: 'U', label: 'U-shaped' },
  { value: 'spiral', label: 'Spiral' }
]

/** Shared value, or undefined when mixed. */
function common<T, K extends keyof T>(items: T[], k: K): T[K] | undefined {
  if (!items.length) return undefined
  const v = JSON.stringify(items[0][k])
  return items.every(i => JSON.stringify(i[k]) === v) ? items[0][k] : undefined
}

function set(field: string, value: unknown) {
  const t = table.value
  if (!t) return
  const cmds = sel.value.map(s => updateEntity(t, s.e.id, { [field]: value } as never))
  execute(cmds.length === 1 ? cmds[0] : batch(`Edit ${sel.value.length} ${t}`, cmds))
}

// ---------- openings: size/position changes must still fit their host edge ----------
function edgeLength(o: Opening) {
  const l = store.data && hostLine(store.data, o.host)
  return l ? dist(l[0], l[1]) : 0
}
function setOpening(patch: Partial<Opening>) {
  const cmds = []
  for (const o of openings.value) {
    const next = { ...o, ...patch }
    const along = fitAlong(next.along, next.width, edgeLength(o))
    if (along === null) return notify('That size does not fit on the wall')
    cmds.push(updateEntity('openings', o.id, { ...patch, along }))
  }
  execute(cmds.length === 1 ? cmds[0] : batch('Edit openings', cmds))
}
const presetItems = computed(() => {
  const k = common(openings.value, 'kind')
  const p = k === 'door' ? DOOR_PRESETS : k === 'window' ? WINDOW_PRESETS : null
  return p ? Object.entries(p).map(([value, x]) => ({ value, label: x.label })) : []
})
function applyPreset(id: string) {
  const k = openings.value[0].kind
  const p = (k === 'door' ? DOOR_PRESETS : WINDOW_PRESETS)[id]
  if (p) setOpening({ preset: id, width: p.width, height: p.height, sill: p.sill })
}

const one = <T,>(xs: T[]) => (xs.length === 1 ? xs[0] : null)
const room = computed<Room | null>(() => one(rooms.value))
const wall = computed<Wall | null>(() => one(walls.value))
const opening = computed<Opening | null>(() => one(openings.value))
const stair = computed<Stair | null>(() => one(stairs.value))
const title = computed(() => {
  const n = sel.value.length
  if (!n) return ''
  if (!table.value) return `${n} items`
  const zk = common(zones.value, 'kind')
  const label = { items: items.value.length === 1 ? (item.value?.name || itemDef.value?.name || 'Item') : 'Item', rooms: 'Room', walls: 'Wall', stairs: 'Stair', zones: zk ? ZONE_KINDS[zk].label : 'Zone', openings: common(openings.value, 'kind') === 'window' ? 'Window' : 'Door' }[table.value as string] ?? table.value
  return n === 1 ? label : `${n} ${label.toLowerCase()}s`
})
const u = () => store.settings.units
const kindItems = ROOM_KINDS.map(k => ({ value: k as string, label: k[0].toUpperCase() + k.slice(1) }))
const materialItems = Object.entries(FLOOR_MATERIALS).map(([value, m]) => ({ value, label: m.label }))
</script>

<template>
  <aside v-if="sel.length" class="w-72 shrink-0 border-l border-default bg-default overflow-y-auto" aria-label="Inspector">
    <header class="flex items-center justify-between px-4 h-11 border-b border-default">
      <h2 class="font-semibold text-highlighted">{{ title }}</h2>
      <UTooltip text="Delete" :kbds="['delete']">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Delete selection" @click="deleteSelection()" />
      </UTooltip>
    </header>

    <div class="p-4 flex flex-col gap-4">
      <!-- Rooms -->
      <template v-if="rooms.length">
        <UFormField v-if="room" label="Name">
          <UInput :model-value="room.name" class="w-full" @change="(e: Event) => set('name', (e.target as HTMLInputElement).value.trim() || room!.name)" />
        </UFormField>
        <UFormField label="Kind">
          <USelect :model-value="common(rooms, 'kind')" :items="kindItems" placeholder="Mixed" class="w-full" @update:model-value="(v: unknown) => set('kind', v)" />
        </UFormField>
        <UFormField label="Floor material">
          <USelect :model-value="common(rooms, 'floorMaterial')" :items="materialItems" placeholder="Mixed" class="w-full" @update:model-value="(v: unknown) => set('floorMaterial', v)" />
        </UFormField>
        <UFormField label="Wall colour">
          <input
            type="color"
            :value="common(rooms, 'wallColor') ?? '#f2efe9'"
            class="h-8 w-full rounded border border-default bg-transparent cursor-pointer"
            aria-label="Wall colour"
            @change="(e: Event) => set('wallColor', (e.target as HTMLInputElement).value)"
          />
        </UFormField>
        <USwitch :model-value="common(rooms, 'ceiling') ?? true" label="Ceiling (shown in walk mode)" @update:model-value="(v: boolean) => set('ceiling', v)" />
        <dl class="grid grid-cols-2 gap-y-1 text-sm pt-2 border-t border-default">
          <dt class="text-muted">Area</dt>
          <dd class="text-right tabular-nums">{{ formatArea(rooms.reduce((s, r) => s + area(r.polygon), 0), u()) }}</dd>
          <template v-if="room">
            <dt class="text-muted">Perimeter</dt>
            <dd class="text-right tabular-nums">{{ format(edges(room.polygon).reduce((s, [a, b]) => s + dist(a, b), 0), u()) }}</dd>
            <dt class="text-muted">Corners</dt>
            <dd class="text-right tabular-nums">{{ room.polygon.length }}</dd>
          </template>
        </dl>
      </template>

      <!-- Doors & windows -->
      <template v-else-if="openings.length">
        <UFormField v-if="presetItems.length" label="Preset">
          <USelect :model-value="presetItems.find(i => i.value === common(openings, 'preset'))?.value" :items="presetItems" placeholder="Custom" class="w-full" @update:model-value="(v: unknown) => applyPreset(v as string)" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Width">
            <LengthInput :model-value="openings[0].width" :min="0.3" :max="6" @update:model-value="v => setOpening({ width: v, preset: 'custom' })" />
          </UFormField>
          <UFormField label="Height">
            <LengthInput :model-value="openings[0].height" :min="0.3" :max="4" @update:model-value="v => setOpening({ height: v, preset: 'custom' })" />
          </UFormField>
          <UFormField v-if="common(openings, 'kind') === 'window'" label="Sill">
            <LengthInput :model-value="openings[0].sill" :min="0" :max="3" @update:model-value="v => setOpening({ sill: v })" />
          </UFormField>
          <UFormField v-if="opening" label="Offset" help="Centre, from the wall start">
            <LengthInput :model-value="opening.along" :min="0" @update:model-value="v => setOpening({ along: v })" />
          </UFormField>
        </div>
        <template v-if="common(openings, 'kind') === 'door'">
          <UFormField label="Hinge">
            <URadioGroup
              orientation="horizontal"
              :model-value="(common(openings, 'props') as any)?.hinge ?? 'left'"
              :items="[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]"
              @update:model-value="(v: unknown) => setOpening({ props: { ...openings[0].props, hinge: v } })"
            />
          </UFormField>
          <UFormField label="Opens">
            <URadioGroup
              orientation="horizontal"
              :model-value="(common(openings, 'props') as any)?.swing ?? 'in'"
              :items="[{ value: 'in', label: 'Inward' }, { value: 'out', label: 'Outward' }]"
              @update:model-value="(v: unknown) => setOpening({ props: { ...openings[0].props, swing: v } })"
            />
          </UFormField>
        </template>
      </template>

      <!-- Free walls -->
      <template v-else-if="walls.length">
        <UFormField label="Type">
          <USelect
            :model-value="common(walls, 'kind')"
            :items="[{ value: 'wall', label: 'Wall' }, { value: 'fence', label: 'Fence' }]"
            placeholder="Mixed"
            class="w-full"
            @update:model-value="(v: unknown) => set('kind', v)"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Thickness">
            <LengthInput :model-value="walls[0].thickness" :min="0.02" :max="1" @update:model-value="v => set('thickness', v)" />
          </UFormField>
          <UFormField label="Height">
            <LengthInput :model-value="walls[0].height" :min="0.2" :max="8" @update:model-value="v => set('height', v)" />
          </UFormField>
        </div>
        <p v-if="wall" class="text-sm text-muted">Length {{ format(dist(wall.a, wall.b), u()) }}</p>
      </template>

      <!-- Furniture -->
      <template v-else-if="items.length">
        <UFormField v-if="item" label="Name">
          <UInput
            :model-value="item.name ?? ''"
            :placeholder="itemDef?.name"
            class="w-full"
            @change="(e: Event) => setItems(() => ({ name: (e.target as HTMLInputElement).value.trim() || null }), 'Rename item')"
          />
        </UFormField>
        <UFormField v-if="itemDef?.variants && itemDef.variants.length > 1" label="Colour / material">
          <USelect
            :model-value="common(items, 'variant') ?? itemDef.variants[0].id"
            :items="itemDef.variants.map(v => ({ value: v.id, label: v.name }))"
            class="w-full"
            @update:model-value="(v: unknown) => setItems(() => ({ variant: v as string }), 'Change colour')"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="itemDef?.placement === 'ceiling' ? 'Gap to ceiling' : 'Height above floor'">
            <LengthInput :model-value="items[0].z" :min="-1" :max="5" @update:model-value="v => setItems(() => ({ z: v }), 'Raise item')" />
          </UFormField>
          <UFormField label="Rotation">
            <UInputNumber
              :model-value="items[0].rotation"
              :step="15"
              size="sm"
              :format-options="{ style: 'unit', unit: 'degree', maximumFractionDigits: 1 }"
              @update:model-value="(v: number | null) => v !== null && setItems(() => ({ rotation: ((v % 360) + 360) % 360 }), 'Rotate')"
            />
          </UFormField>
          <UFormField label="Scale" :help="`${scaleLimits.min}× – ${scaleLimits.max}×`">
            <UInputNumber
              :model-value="items[0].scale[0]"
              :step="0.05"
              :min="scaleLimits.min"
              :max="scaleLimits.max"
              size="sm"
              @update:model-value="(v: number | null) => v && setItems(() => ({ scale: [v, v, v] }), 'Scale')"
            />
          </UFormField>
        </div>
        <dl v-if="itemDef && item" class="grid grid-cols-2 gap-y-1 text-sm pt-2 border-t border-default">
          <dt class="text-muted">Size</dt>
          <dd class="text-right tabular-nums">
            {{ itemDef.size.map(v => format(v * item!.scale[0], u())).join(' × ') }}
          </dd>
          <dt class="text-muted">Catalog</dt>
          <dd class="text-right">{{ itemDef.name }}</dd>
        </dl>
        <p class="text-xs text-muted">R / Shift+R rotates 15° · arrows nudge 1 cm (Shift: 10 cm)</p>
      </template>

      <!-- Garden zones -->
      <template v-else-if="zones.length">
        <UFormField label="Type">
          <USelect :model-value="common(zones, 'kind')" :items="zoneItems" placeholder="Mixed" class="w-full" @update:model-value="(v: unknown) => setZoneKind(v as string)" />
        </UFormField>
        <UFormField v-if="common(zones, 'kind') === 'pool'" label="Depth">
          <LengthInput
            :model-value="Number(zones[0].props.depth ?? POOL_DEPTH)"
            :min="0.3"
            :max="4"
            @update:model-value="v => execute(batch('Pool depth', zones.map(z => updateEntity('zones', z.id, { props: { ...z.props, depth: v } }))))"
          />
        </UFormField>
        <dl class="grid grid-cols-2 gap-y-1 text-sm pt-2 border-t border-default">
          <dt class="text-muted">Area</dt>
          <dd class="text-right tabular-nums">{{ formatArea(zones.reduce((s, z) => s + area(z.polygon), 0), u()) }}</dd>
        </dl>
      </template>

      <!-- Stairs -->
      <template v-else-if="stairs.length">
        <UFormField label="Type">
          <USelect :model-value="common(stairs, 'kind')" :items="stairKinds" placeholder="Mixed" class="w-full" @update:model-value="(v: unknown) => setStair({ kind: v as Stair['kind'] })" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Width">
            <LengthInput :model-value="stairs[0].params.width" :min="0.6" :max="3" @update:model-value="v => setStair({}, { width: v })" />
          </UFormField>
          <UFormField label="Steps">
            <UInputNumber :model-value="stairs[0].params.steps" :min="3" :max="40" size="sm" @update:model-value="(v: number | null) => v && setStair({}, { steps: v })" />
          </UFormField>
          <UFormField label="Going" help="Tread depth">
            <LengthInput :model-value="stairs[0].params.going" :min="0.15" :max="0.45" @update:model-value="v => setStair({}, { going: v })" />
          </UFormField>
          <UFormField label="Rotation">
            <UInputNumber
              :model-value="stairs[0].rotation"
              :step="15"
              size="sm"
              :format-options="{ style: 'unit', unit: 'degree' }"
              @update:model-value="(v: number | null) => v !== null && setStair({ rotation: ((v % 360) + 360) % 360 })"
            />
          </UFormField>
        </div>
        <USwitch v-if="common(stairs, 'kind') !== 'spiral'" :model-value="stairs[0].params.railLeft" label="Railing left" @update:model-value="(v: boolean) => setStair({}, { railLeft: v })" />
        <USwitch :model-value="stairs[0].params.railRight" :label="common(stairs, 'kind') === 'spiral' ? 'Railing (outer)' : 'Railing right'" @update:model-value="(v: boolean) => setStair({}, { railRight: v })" />
        <template v-if="stair">
          <dl class="grid grid-cols-2 gap-y-1 text-sm pt-2 border-t border-default">
            <dt class="text-muted">Total rise</dt>
            <dd class="text-right tabular-nums">{{ format(stairRise(store.data!, stair.floorId, store.settings.slab), u()) }}</dd>
            <dt class="text-muted">Rise per step</dt>
            <dd class="text-right tabular-nums">{{ format(stairSol(stair).rise, u(), 3) }}</dd>
            <dt class="text-muted">Run length</dt>
            <dd class="text-right tabular-nums">{{ format(stairSol(stair).runLength, u()) }}</dd>
          </dl>
          <div class="flex flex-col gap-1.5">
            <UBadge v-for="w in stairSol(stair).warnings" :key="w.code" color="warning" variant="subtle" icon="i-lucide-triangle-alert" class="whitespace-normal">
              {{ warningText(w) }}
            </UBadge>
            <UBadge v-if="!stairSol(stair).warnings.length" color="success" variant="subtle" icon="i-lucide-check">Comfortable stair</UBadge>
          </div>
        </template>
      </template>

      <p v-else class="text-sm text-muted">Mixed selection. Select items of one kind to edit their properties.</p>
    </div>
  </aside>
</template>
