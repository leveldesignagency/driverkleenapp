type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function ContractorPageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
