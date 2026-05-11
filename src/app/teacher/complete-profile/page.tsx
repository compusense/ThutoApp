
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { completeUserProfile } from '@/app/actions';
import { useUser } from '@/firebase/auth/use-user';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

const posts = [
  "Teacher Aide",
  "Assistant Teacher",
  "Teacher",
  "Senior Teacher 2",
  "Senior Teacher 1",
  "Senior Teacher w/o Portfolio",
  "HOD",
  "Deputy School Head",
];

const seniorTeacherPortfolios = [
    "Practicals",
    "Maths and Science",
    "Guidance & Counselling",
    "Sports and Culture",
    "Learning Difficulties",
    "Languages"
];

const hodPortfolios = [
    "Learning Difficulties",
    "Lower",
    "Middle",
    "Upper",
];

const salaryScales = ["B4", "B3", "B2", "B1", "C4", "C2", "C1", "D4", "D3", "D2", "D1"];
const qualifications = [
    "Diploma - Primary Education",
    "Degree - Primary Education",
    "Degree - SPED",
    "Degree - Guidance & Counselling",
    "Degree - Education Management",
    "Masters - Primary Education",
    "Masters - Guidance & Counselling",
    "Masters in Education",
    "Mphill",
    "Diploma - Secondary Education",
    "Degree + PGDE",
    "Other Teaching Qualification"
];
const employmentNatures = ["Permanent & Pensionable", "Contract", "Temporary"];

const nationalities = [
    "Angolan", "Motswana", "Comoran", "Congolese", "Swazi", "Lesotho", 
    "Malagasy", "Malawian", "Mauritian", "Mozambican", "Namibian", 
    "Seychellois", "South African", "Tanzanian", "Zambian", "Zimbabwean", "Other"
];

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  surname: z.string().min(1, 'Surname is required'),
  gender: z.enum(['Male', 'Female'], { required_error: 'Gender is required' }),
  dateOfBirth: z.date({ required_error: 'Date of birth is required' }),
  post: z.string({ required_error: 'Post is required' }),
  portfolio: z.string().optional(),
  salaryScale: z.string({ required_error: 'Salary Scale is required' }),
  qualification: z.string({ required_error: 'Qualification is required' }),
  qualificationDetails: z.string().optional(),
  otherQualification: z.string().optional(),
  nationality: z.string().min(1, 'Nationality is required'),
  otherNationality: z.string().optional(),
  natureOfEmployment: z.enum(['Permanent & Pensionable', 'Contract', 'Temporary'], { required_error: 'Nature of employment is required' }),
}).superRefine((data, ctx) => {
    if ((data.post === 'Senior Teacher 1' || data.post === 'HOD') && (!data.portfolio || data.portfolio.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Portfolio is required for this post',
            path: ['portfolio'],
        });
    }
    if (data.qualification === 'Degree + PGDE' && (!data.qualificationDetails || data.qualificationDetails.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your qualification details',
            path: ['qualificationDetails'],
        });
    }
     if (data.qualification === 'Other Teaching Qualification' && (!data.otherQualification || data.otherQualification.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your qualification',
            path: ['otherQualification'],
        });
    }
    if (data.nationality === 'Other' && (!data.otherNationality || data.otherNationality.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify your nationality',
            path: ['otherNationality'],
        });
    }
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const FORM_STORAGE_KEY = 'thuto-complete-profile-draft-teacher';

export default function CompleteProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      nationality: '',
    },
  });

  const watchedValues = form.watch();
  const watchedPost = watchedValues.post;
  const watchedQual = watchedValues.qualification;
  const watchedNationality = watchedValues.nationality;

  // Load saved data from localStorage on initial render
  React.useEffect(() => {
    const savedData = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Ensure date strings are converted back to Date objects
      if (parsedData.dateOfBirth) {
        parsedData.dateOfBirth = new Date(parsedData.dateOfBirth);
      }
      form.reset(parsedData);
    }
  }, [form]);

  // Save data to localStorage whenever the form values change
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  async function onSubmit(values: ProfileFormValues) {
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'You must be logged in to update your profile.',
        });
        return;
    }

    setIsSubmitting(true);
    try {
      const result = await completeUserProfile({ uid: user.uid, ...values });
      if (result.success) {
        toast({
          title: 'Profile Updated',
          description: 'Your details have been saved successfully.',
        });
        // Clear saved data on successful submission
        localStorage.removeItem(FORM_STORAGE_KEY);
        router.push('/teacher/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error updating profile',
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'An unexpected error occurred',
        description: 'Please try again later.',
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Please fill in your details to continue. This is a one-time process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name(s)</FormLabel>
                      <FormControl>
                        <Input placeholder="Your first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surname</FormLabel>
                      <FormControl>
                        <Input placeholder="Your surname" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date of Birth</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              captionLayout="dropdown-buttons"
                              fromYear={1930}
                              toYear={new Date().getFullYear()}
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1930-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="space-y-3 pt-2">
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex items-center space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="Male" />
                            </FormControl>
                            <FormLabel className="font-normal">Male</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="Female" />
                            </FormControl>
                            <FormLabel className="font-normal">Female</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your nationality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {nationalities.map((nationality) => (
                            <SelectItem key={nationality} value={nationality}>
                              {nationality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedNationality === 'Other' && (
                    <FormField
                    control={form.control}
                    name="otherNationality"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Please Specify Nationality</FormLabel>
                        <FormControl>
                            <Input placeholder="Your nationality" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
                <FormField
                  control={form.control}
                  name="natureOfEmployment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nature of Employment</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select employment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employmentNatures.map((nature) => (
                            <SelectItem key={nature} value={nature}>
                              {nature}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="post"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Post</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your post" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {posts.map((post) => (
                            <SelectItem key={post} value={post}>
                              {post}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedPost === 'Senior Teacher 1' && (
                  <FormField
                    control={form.control}
                    name="portfolio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portfolio</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your portfolio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {seniorTeacherPortfolios.map((portfolio) => (
                              <SelectItem key={portfolio} value={portfolio}>
                                {portfolio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {watchedPost === 'HOD' && (
                  <FormField
                    control={form.control}
                    name="portfolio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HOD Portfolio</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select HOD portfolio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {hodPortfolios.map((portfolio) => (
                              <SelectItem key={portfolio} value={portfolio}>
                                {portfolio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="salaryScale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salary Scale</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select salary scale" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salaryScales.map((scale) => (
                            <SelectItem key={scale} value={scale}>
                              {scale}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="qualification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualification</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select highest qualification" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {qualifications.map((qual) => (
                            <SelectItem key={qual} value={qual}>
                              {qual}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedQual === 'Degree + PGDE' && (
                  <FormField
                    control={form.control}
                    name="qualificationDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Please Specify</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Degree in Computer Science, or details about your other qualification"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                 {watchedQual === 'Other Teaching Qualification' && (
                  <FormField
                    control={form.control}
                    name="otherQualification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specify Qualification</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please specify your teaching qualification"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save and Continue'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
