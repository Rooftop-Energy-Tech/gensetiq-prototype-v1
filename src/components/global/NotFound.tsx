import {Link} from '@tanstack/react-router';

import {Button} from '@/components/ui/button';
import {gensetSearch} from '@/modules/genset/types/view.type';

export const NotFound = () => (
  <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-medium text-primary">Page not found</h1>
      <p className="text-sm text-secondary">
        That route doesn’t exist in this prototype yet.
      </p>
    </div>
    <Button asChild>
      <Link to="/gensets" search={gensetSearch()}>Back to gensets</Link>
    </Button>
  </div>
);
