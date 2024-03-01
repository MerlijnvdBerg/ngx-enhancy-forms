import {
	AfterViewInit,
	Component,
	ContentChild,
	ElementRef,
	Inject,
	InjectionToken,
	Input,
	Optional,
	TemplateRef,
	ViewChild
} from '@angular/core';
import {AbstractControl, NG_VALUE_ACCESSOR, UntypedFormControl} from '@angular/forms';
import {ValueAccessorBase} from '../../elements/value-accessor-base/value-accessor-base.component';
import {CustomErrorMessages, FormErrorMessages} from '../../types';
import {isValueSet, stringIsSetAndFilled} from '../../util/values';
import {FormComponent} from '../form.component';
import {awaitableForNextCycle} from "../../util/angular";


export const FORM_ERROR_MESSAGES = new InjectionToken<CustomErrorMessages>('form.error.messages');

export const DEFAULT_ERROR_MESSAGES: FormErrorMessages = {
	min: 'Use a number larger than %min%',
	max: 'Use a number smaller than %max%',
	required: 'Required',
	email: 'Use a valid email address',
	minLength: 'Has to be longer than %minLength% character(s)',
	maxLength: 'Has to be shorter than %maxLength% character(s)',
	pattern: 'This input is not valid',
	matchPassword: 'Passwords must match',
	date: 'Enter a valid date',
};

@Component({
	selector: 'klp-form-element',
	templateUrl: './form-element.component.html',
	styleUrls: ['./form-element.component.scss'],
})
export class FormElementComponent implements AfterViewInit {
	public attachedControl: AbstractControl;
	@Input() public caption: string;
	@Input() public direction: 'horizontal' | 'vertical' = 'horizontal';
	@Input() public captionSpacing: 'percentages' | 'none' = 'percentages';
	@Input() public spaceDistribution: '40-60' | '34-66' | '30-70' | 'fixedInputWidth' = '40-60';
	@Input() public swapInputAndCaption = false;
	@Input() public errorMessageAsTooltip = false;
	@ViewChild('internalComponentRef') public internalComponentRef: ElementRef;
	@ViewChild('tailTpl') public tailTpl: TemplateRef<any>;
	@ViewChild('captionDummyForSpaceCalculation') public captionDummyForSpaceCalculation: ElementRef;
	@ContentChild(NG_VALUE_ACCESSOR) fieldInput: ValueAccessorBase<any>;


	public captionRef: TemplateRef<any>;
	public errorMessages: FormErrorMessages = DEFAULT_ERROR_MESSAGES;
	public customErrorHandlers: Array<{ error: string; templateRef: ElementRef }> = [];
	private input: ValueAccessorBase<any>;
	private errorMessageTruncated: boolean;

	constructor(
		@Optional() private parent: FormComponent,
		@Inject(FORM_ERROR_MESSAGES) @Optional() private customMessages: CustomErrorMessages,
	) {
	}

	async ngAfterViewInit(): Promise<void> {
		await awaitableForNextCycle();
		this.fieldInput?.setTailTpl(this.tailTpl);
	}

	public shouldShowErrorMessages(): boolean {
		return this.parent?.showErrorMessages !== false;
	}

	public substituteParameters(message: string, parameters: Record<string, any>): string {
		return Object.keys(parameters).reduce((msg, key) => {
			return msg.replace(`%${key}%`, parameters[key]);
		}, message);
	}

	public registerControl(formControl: UntypedFormControl, input: ValueAccessorBase<any> = null): void {
		this.attachedControl = formControl;
		this.parent.registerControl(formControl, this);
		this.input = input;
		this.attachedControl.statusChanges.subscribe((e) => {
			console.log(this.caption, e);
		});
	}

	public unregisterControl(formControl: UntypedFormControl): void {
		this.attachedControl = null;
		this.parent.unregisterControl(formControl);
	}

	public getAttachedControl(): AbstractControl {
		return this.attachedControl;
	}

	public getAttachedInput(): ValueAccessorBase<any> {
		return this.input;
	}

	public registerErrorHandler(error: string, templateRef: ElementRef): void {
		this.customErrorHandlers.push({error, templateRef});
	}

	public registerCaption(templateRef: TemplateRef<any>): void {
		this.captionRef = templateRef;
	}

	getWarningToShow(): string {
		return this.parent?.getWarningToShow(this.attachedControl);
	}

	getErrorToShow(forCalculation: boolean = false): string {
		const firstError = Object.keys(this.attachedControl?.errors ?? {})[0];
		if (forCalculation) {
			return firstError;
		}
		if (this.attachedControl?.touched !== true) {
			return null;
		}
		if (!this.attachedControl?.errors)  {
			return null;
		}
		return firstError;
	}

	getCustomErrorHandler(error: string): { error: string; templateRef: ElementRef } {
		return this.customErrorHandlers.find((e) => e.error === error);
	}

	showDefaultError(error: string): boolean {
		return this.getErrorToShow() === error && !this.customErrorHandlers.some((e) => e.error === error);
	}

	getScrollableParent(node): any {
		if (node == null) {
			return null;
		}
		if (node.scrollHeight > node.clientHeight) {
			return node;
		} else {
			return this.getScrollableParent(node.parentNode);
		}
	}

	scrollTo(): void{
		this.internalComponentRef.nativeElement.scrollIntoView(true);
		// to give some breathing room, we scroll 100px more to the top
		this.getScrollableParent(this.internalComponentRef.nativeElement)?.scrollBy(0, -100);
	}

	isRequired(): boolean {
		if (isValueSet(this.input)) {
			return this.input.hasValidator('required');
		}
		return false;
	}

	getErrorMessage(key: keyof FormErrorMessages): string {
		return this.customMessages?.[key]?.() ?? this.errorMessages[key];
	}

	public getErrorLocation(): 'belowCaption' | 'rightOfCaption' {
		return this.parent?.errorMessageLocation ?? 'belowCaption';
	}

	public shouldShowErrorTooltip(): boolean {
		if (stringIsSetAndFilled(this.getErrorToShow())) {
			return false;
		}
		if (stringIsSetAndFilled(this.getWarningToShow())) {
			return true;
		}
		return false;
	}

	public hasRightOfCaptionError(): boolean {
		if (this.errorMessageAsTooltip) {
			return false;
		}
		if (this.direction !== 'vertical' || this.getErrorLocation() !== 'rightOfCaption') {
			return false;
		}
		return true;
	}

	public isErrorMessageTruncated(): boolean {
		return this.errorMessageTruncated;
	}

	public setErrorMessageIsTruncated(): boolean {
		if (this.errorMessageAsTooltip) {
			return false;
		}
		if (this.direction !== 'vertical' || this.getErrorLocation() !== 'rightOfCaption') {
			return  false;
		}
		const errorElement = this.captionDummyForSpaceCalculation?.nativeElement?.querySelectorAll('.rightOfCaptionError .errorContainer *');
		if (isValueSet(errorElement)) {
			this.errorMessageTruncated = [...errorElement].some(e => e.scrollWidth > e.clientWidth);
		} else {
			this.errorMessageTruncated = false;
		}
		return true;
	}
}
