
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye, UserSearch } from 'lucide-react';

const formSchema = z.object({
  employeeName: z.string().min(2, 'Employee name is required'),
  idNumber: z.string().min(2, 'ID number is required'),
  position: z.string().min(2, 'Position is required'),
  startDate: z.string().min(2, 'Start date is required'),
  employmentType: z.enum(['Permanent & Pensionable', 'Contract']),
  expiryDate: z.string().optional(),
  salaryScale: z.string().min(2, 'Salary scale is required'),
  postalAddress: z.string().min(2, 'Postal address is required'),
  physicalAddress: z.string().min(2, 'Physical address is required'),
  houseNumber: z.string().optional(),
  destinationAddress: z.string().min(2, 'Destination address is required'),
});

type FormValues = z.infer<typeof formSchema>;

interface ConfirmationLetterFormProps {
  onPreview: (values: FormValues & { type: 'confirmation' }) => void;
  isLoading: boolean;
}

export function ConfirmationLetterForm({ onPreview, isLoading }: ConfirmationLetterFormProps) {
  const { user } = useUser();
  const [staff, setStaff] = React.useState<UserProfile[]>([]);
  const [isFetchingStaff, setIsFetchingStaff] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeName: '',
      idNumber: '',
      position: '',
      startDate: '',
      employmentType: 'Permanent & Pensionable',
      expiryDate: '',
      salaryScale: '',
      postalAddress: '',
      physicalAddress: '',
      houseNumber: '',
      destinationAddress: 'To whom it may concern',
    },
  });

  const employmentType = form.watch('employmentType');

  // Fetch staff and school address
  React.useEffect(() => {
    if (!user?.schoolId) return;

    const fetchData = async () => {
      setIsFetchingStaff(true);
      try {
        // Fetch Staff
        const staffRoles = ['teacher', 'school-head', 'deputy-school-head', 'HOD', 'Senior Teacher 1', 'Senior Teacher 2'];
        const q = query(
          collection(firestore, 'users'),
          where('schoolId', '==', user.schoolId),
          where('role', 'in', staffRoles)
        );
        const querySnapshot = await getDocs(q);
        const staffList = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
        setStaff(staffList);

        // Fetch School for default postal address
        const schoolDoc = await getDoc(doc(firestore, 'schools', user.schoolId));
        if (schoolDoc.exists()) {
          const schoolData = schoolDoc.data();
          if (schoolData.postalAddress) {
            form.setValue('postalAddress', schoolData.postalAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsFetchingStaff(false);
      }
    };

    fetchData();
  }, [user?.schoolId, form]);

  const handleStaffSelect = (uid: string) => {
    const selectedStaff = staff.find(s => s.uid === uid);
    if (selectedStaff) {
      form.setValue('employeeName', selectedStaff.displayName || '');
      form.setValue('idNumber', selectedStaff.idNumber || '');
      form.setValue('position', selectedStaff.designation || selectedStaff.role || '');
      form.setValue('salaryScale', selectedStaff.salaryScale || '');
      form.setValue('physicalAddress', selectedStaff.physicalAddress || '');
      form.setValue('houseNumber', selectedStaff.houseNumber || '');
      if (selectedStaff.employmentType) {
        form.setValue('employmentType', selectedStaff.employmentType as any);
      }
      if (selectedStaff.startDate) {
        form.setValue('startDate', selectedStaff.startDate);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onPreview({ ...values, type: 'confirmation' }))} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem>
            <FormLabel>Select Employee (Auto-fill)</FormLabel>
            <Select onValueChange={handleStaffSelect} disabled={isFetchingStaff}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={isFetchingStaff ? "Loading staff..." : "Select a staff member"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.uid} value={s.uid}>
                    {s.displayName || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>

          <FormField
            control={form.control}
            name="destinationAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="employeeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee Name</FormLabel>
                <FormControl>
                  <Input placeholder="Full Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="idNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID Number</FormLabel>
                <FormControl>
                  <Input placeholder="Identity Number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. IT Officer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 01 February 2018" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salaryScale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Scale</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. C3 – P133 446.60 per annum" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nature of Employment</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employment type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Permanent & Pensionable">Permanent & Pensionable</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {employmentType === 'Contract' && (
            <FormField
              control={form.control}
              name="expiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="postalAddress"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Postal Address (PO Box)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. PO Box 359 Kang" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="physicalAddress"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Physical Address</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Inalegolo, Logare Ward" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="houseNumber"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>House Number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. HSD IT8" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isLoading}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Preview & Print
          </Button>
        </div>
      </form>
    </Form>
  );
}
