import { WORLD } from '../config/game';
export type StoreKind = 'market' | 'restaurant' | 'bar' | 'fuel' | 'auto' | 'clinic' | 'hotel' | 'clothing' | 'cafe' | 'bank' | 'gym' | 'salon' | 'electronics' | 'cinema' | 'realty' | 'arcade' | 'bookshop' | 'weapons' | 'carwash' | 'home';
export interface StoreArchetype { kind: StoreKind; name: string; subtitle: string; color: string; service: string; price: number; requiredFlag?: string; servicePoint?: { x: number; z: number }; }
export const APARTMENT = { id: '3,0', x: 416, z: -27 };
const RESIDENCE: StoreArchetype = { kind: 'home', name: 'COVE HOUSE · 03', subtitle: 'PRIVATE HARBOR RESIDENCE', color: '#7e8e7a', service: 'Sleep eight hours & save · 在家休息存档', price: 0, requiredFlag: 'owns:apartment' };
export const ARCHETYPES: StoreArchetype[] = [
  { kind: 'market', name: 'FRESH & CO.', subtitle: 'NEIGHBORHOOD MARKET', color: '#2f6f61', service: 'Browse groceries', price: 0 },
  { kind: 'restaurant', name: 'SUNSET DINER', subtitle: 'GOOD FOOD · GOOD COMPANY', color: '#a66a4c', service: 'Order a hot meal · 恢复生命', price: 18 },
  { kind: 'bar', name: 'THE LOW TIDE', subtitle: 'BAR · MUSIC · AFTER HOURS', color: '#60556d', service: 'Order a citrus mocktail', price: 12 },
  { kind: 'fuel', name: 'AZURE ENERGY', subtitle: 'FUEL · REPAIR · ROAD TRIPS', color: '#458487', service: 'Fill vehicle fuel tank', price: 30 },
  { kind: 'auto', name: 'MONARCH MOTORS', subtitle: 'SALES · SERVICE · GARAGE', color: '#496174', service: 'Repair your vehicle', price: 45 },
  { kind: 'clinic', name: 'HARBOR HEALTH', subtitle: 'WALK-IN CLINIC', color: '#789b8b', service: 'Full medical treatment', price: 25 },
  { kind: 'hotel', name: 'THE MERIDIAN', subtitle: 'A PLACE TO STAY', color: '#8f7659', service: 'Rest & save game', price: 35 },
  { kind: 'clothing', name: 'COMMON THREAD', subtitle: 'EVERYDAY ORIGINALS', color: '#996f60', service: 'Buy a coastal outfit', price: 60 },
  { kind: 'cafe', name: 'FIKA COFFEE', subtitle: 'SLOW DOWN · STAY A WHILE', color: '#876d50', service: 'Order a specialty coffee', price: 8 },
  { kind: 'bank', name: 'CIVIC BANK', subtitle: 'YOUR LOCAL BRANCH', color: '#49636c', service: 'Deposit $100 cash', price: 100 },
  { kind: 'gym', name: 'FORM ATHLETIC', subtitle: 'MOVE WITH PURPOSE', color: '#768257', service: 'Training session · 恢复生命', price: 15 },
  { kind: 'salon', name: 'STUDIO CUT', subtitle: 'BARBER & GROOMING', color: '#7c6976', service: 'Change your look', price: 20 },
  { kind: 'electronics', name: 'SIGNAL', subtitle: 'TECH FOR EVERY DAY', color: '#567e8c', service: 'Buy a city phone', price: 90 },
  { kind: 'cinema', name: 'AZURE PICTUREHOUSE', subtitle: 'INDEPENDENT CINEMA', color: '#87624f', service: 'Watch a short ambient show', price: 14, servicePoint: { x: -5, z: 9 } },
  { kind: 'realty', name: 'COVE LIVING', subtitle: 'FIND YOUR PLACE', color: '#799381', service: 'Rent a harbor apartment', price: 150 },
  { kind: 'arcade', name: 'PLAYTIME', subtitle: 'GAMES · GOOD TIMES', color: '#9a779a', service: 'Harbor Lights · 20 秒反应小游戏', price: 5 },
  { kind: 'bookshop', name: 'CHAPTER ONE', subtitle: 'BOOKS · LOCAL STORIES', color: '#788963', service: 'Buy the Port Azure guide', price: 10 },
  { kind: 'weapons', name: 'SENTINEL SPORT', subtitle: 'FICTIONAL SANDBOX EQUIPMENT', color: '#746e56', service: 'Browse original equipment & ammunition', price: 0 },
  { kind: 'carwash', name: 'SPLASH AUTO', subtitle: 'A FRESH START', color: '#588a9c', service: 'Wash & repaint vehicle', price: 20 },
];
export interface StoreLocation { id: string; x: number; z: number; archetype: StoreArchetype; }
export function storeForChunk(id: string): StoreLocation {
  const [cx, cz] = id.split(',').map(Number);
  if (id === APARTMENT.id) return { ...APARTMENT, archetype: RESIDENCE };
  let index = Math.abs(cx * 7 + cz * 3) % ARCHETYPES.length;
  if (id === '0,0') index = 0;
  if (id === '1,0') index = 1;
  if (id === '0,1') index = 2;
  if (id === '1,1') index = 3;
  if (id === '2,0') index = 4;
  return { id, x: cx * WORLD.chunkSize + 32, z: cz * WORLD.chunkSize - 27, archetype: ARCHETYPES[index] };
}
