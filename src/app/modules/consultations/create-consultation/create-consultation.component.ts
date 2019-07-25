import { Component, OnInit, EventEmitter, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { CreateConsultationMutation,
         MinistryAutocompleteQuery,
         ConstantForTypeQuery,
         MinistryCreateMutation } from './create-consultation.graphql';
import {debounceTime, distinctUntilChanged, map, switchMap, takeWhile, tap} from 'rxjs/operators';
import { ModalDirective } from 'ngx-bootstrap';
import { UploadOutput, UploadInput, UploadFile, humanizeBytes } from 'ngx-uploader';
import { ErrorService } from 'src/app/shared/components/error-modal/error.service';

@Component({
  selector: 'app-create-consultation',
  templateUrl: './create-consultation.component.html',
  styleUrls: ['./create-consultation.component.scss']
})
export class CreateConsultationComponent implements OnInit {

  @ViewChild('addMinistryModal') addMinistryModal: ModalDirective;

  consultationInfo = {
    title: '',
    url: '',
    responseDeadline: null
  };

  departmentInfo = {
    ministryId: null
  };

  ministryObject = {
    name: '',
    categoryId: null,
    logoFile: {
      filename: '',
      content: null
    },
    level: null,
    pocEmailPrimary: '',
    pocEmailSecondary: ''
  };

  step = 1;
  searchEmitter: EventEmitter<any> = new EventEmitter();
  ministries: any;
  loadingMinistries: boolean;
  categoriesList: any;
  levels = [
    {
      id: 1,
      name: 'national'
    },
    {
      id: 2,
      name: 'state'
    },
    {
      id: 3,
      name: 'local'
    }
  ];

  files: any;
  uploadInput: EventEmitter<UploadInput>;
  uploadFile: EventEmitter<UploadFile>;
  humanizeBytes: Function;
  showAddMinistryBlock: boolean;
  searchText: any;

  constructor(
    private apollo: Apollo,
    private errorService: ErrorService,
    private _ngZone: NgZone,
    ) {
    this.getCateoriesList();
  }

  ngOnInit() {
    this.subscribeToSearch();
  }

  getCateoriesList() {
    this.apollo.query({
      query: ConstantForTypeQuery,
      variables: {
        constantType: 'ministry_category'
      }
    })
    .pipe(
      map((i: any) => i.data.constantForType)
    )
    .subscribe((list) => {
      this.categoriesList = list;
    }, err => {
      this.errorService.showErrorModal(err);
    });
  }

  subscribeToSearch() {
    this.searchEmitter
      .pipe(
        distinctUntilChanged(),
        debounceTime(400),
        takeWhile(data => !!data),
        switchMap(data => {
          if (data) {
            this.loadingMinistries = true;
            return this.searchMinistry(data.term);
          }
        })
      )
      .subscribe((result) => {
        this.loadingMinistries = false;
        this.ministries = result;
        if (this.searchText && !this.ministries.length) {
          this.showAddMinistryBlock = true;
        } else {
          this.showAddMinistryBlock = false;
        }
      }, (err: any) => this.loadingMinistries = false);
  }

  onSearch(query: any) {
    if (!query.term) {
      this.searchText = '';
      query = null;
      return;
    }
    this.searchText = query['term'];
    this.searchEmitter.emit(query);
  }

  searchMinistry(name: string) {
    if (name && name.trim()) {
      return this.apollo.query({
          query: MinistryAutocompleteQuery,
          variables: {
            q: name
          }
        })
        .pipe(
          map((i: any) => i.data.ministryAutocomplete),
          tap(() => this.loadingMinistries = false)
        );
    }
  }

  onClose() {
    this._ngZone.run(() => {
      setTimeout(() => {
        this.showAddMinistryBlock = false;
      }, 100);
    });
  }


  stepNext(valid) {
    if (valid) {
      this.step = 2;
    }
  }

  openAddMinistryModal() {
    this.ministryObject.name = this.searchText;
    this.showAddMinistryBlock = false;
    this.addMinistryModal.show();
  }

  hideAddMinistryModal() {
    this.addMinistryModal.hide();
  }


toBase64(files: any[]) {
    files.forEach((file: File) => {
        const reader: FileReader = new FileReader();
        reader.onloadend = (ev: any) => {
            this.ministryObject.logoFile = {
              filename: file.name,
              content: ev.target.result || ev.dataTransfer.files[0]
              };
        };
        reader.readAsDataURL(file);
    });
}

onUploadOutput(output: UploadOutput): void {
    if (output.type === 'addedToQueue') {
        this.files = [output.file.nativeFile]; // add file to array when added
    }
    if (output.type === 'allAddedToQueue') { // when all files added in queue
        this.toBase64(this.files);
    }
}

addMinistry(valid) {
  if (valid && this.ministryObject.logoFile.filename) {
      this.apollo.mutate({
          mutation: MinistryCreateMutation,
          variables: {
            ministry: this.ministryObject
          }
        })
        .subscribe((res) => {
          this.addMinistryModal.hide();
        }, err => {
          this.errorService.showErrorModal(err);
        });
  }
}

  submit(valid) {
    if (valid) {
      const variables = {
        consultation: {...this.consultationInfo, ...this.departmentInfo}
      };
      this.apollo.mutate({
        mutation: CreateConsultationMutation,
        variables: variables
      })
      .subscribe((res) => {
      }, err => {
        this.errorService.showErrorModal(err);
      });
    }
  }
}