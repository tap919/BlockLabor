import { motion } from 'motion/react';
import { CheckCircle2, Package, ShoppingCart, Calendar, Trash2, Truck, FileText } from 'lucide-react';

const categoryDetails = [
  {
    name: 'Light Industrial',
    icon: Package,
    description: 'Warehouse support, basic assembly, packing lines, and material handling.',
    contractorBrings: 'Reliability, physical capability, following process instructions.',
    clientProvides: 'Safety gear (PPE), immediate supervision, defined workflows.'
  },
  {
    name: 'Retail Support',
    icon: ShoppingCart,
    description: 'Merchandising, inventory counting, endcap displays, and peak hour floor coverage.',
    contractorBrings: 'Basic customer service, neat appearance, attention to detail.',
    clientProvides: 'Store protocols, pricing guns, clear floor direction.'
  },
  {
    name: 'Event Staffing',
    icon: Calendar,
    description: 'Registration desk, crowd direction, tear-down, and ushering.',
    contractorBrings: 'High energy, professional demeanor, adaptability.',
    clientProvides: 'Event briefings, branded shirts/lanyards, clear posts.'
  },
  {
    name: 'Cleaning / Janitorial',
    icon: Trash2,
    description: 'Commercial space turnovers, post-event cleanup, floor care, and waste removal.',
    contractorBrings: 'Eye for cleanliness, endurance, respect for property.',
    clientProvides: 'All cleaning chemicals, equipment, hazard protocols.'
  },
  {
    name: 'Delivery Assistance',
    icon: Truck,
    description: 'Ride-along helpers, unloading dock support, and last-mile package running.',
    contractorBrings: 'Heavy lifting capability, punctuality, teamwork.',
    clientProvides: 'The vehicle, route planning, lifting equipment.'
  },
  {
    name: 'Admin Support',
    icon: FileText,
    description: 'Data entry backlog, document filing, mailrooms, and basic reception overflow.',
    contractorBrings: 'Computer literacy, organization, discretion.',
    clientProvides: 'Workstation access, clear data instructions, software logins.'
  }
];

export function ServicesView() {
  return (
    <div className="min-h-screen bg-[#0F1115] py-16 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-white mb-4">Labor Categories</h1>
          <p className="text-[#8E9299] max-w-2xl mx-auto">
            We only offer what our collective can reliably perform. Clear task boundaries ensure we remain an independent marketplace rather than an employment agency.
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {categoryDetails.map((cat, idx) => (
            <div key={idx} className="bg-[#161920] border border-[#2A2D35] rounded-xl p-8 flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[#1F232B] border border-[#373A43] text-[#10B981] rounded flex items-center justify-center">
                  <cat.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">{cat.name}</h3>
              </div>
              
              <p className="text-[#E0E0E6] text-sm mb-6 flex-grow">{cat.description}</p>
              
              <div className="space-y-4 pt-6 border-t border-[#2A2D35]">
                <div>
                   <h4 className="text-[10px] uppercase tracking-widest text-[#8E9299] mb-1">Contractor Brings</h4>
                   <p className="text-sm text-[#E0E0E6]">{cat.contractorBrings}</p>
                </div>
                <div>
                   <h4 className="text-[10px] uppercase tracking-widest text-[#8E9299] mb-1">Client Must Provide</h4>
                   <p className="text-sm text-[#E0E0E6]">{cat.clientProvides}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
